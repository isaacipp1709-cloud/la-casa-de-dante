// Panel central de conexiones de La Casa: estado, toggles y aislamiento.
//
// LIMITACION EXPLICITA: no se contacta Dante-AI-Core, Neon ni Supabase reales.
// Se usan payloads del Core y stores falsos, y el estado sintetico del modo mock.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConnectionsPanelSchema, type ConnectionsStatusResponse } from '../src/contracts/connections';
import { bridgeErrorMessage, composeConnectionsPanel } from '../src/lib/connections/connection-panel';
import { buildMockCoreConnections } from '../src/lib/connections/mock-connections';
import { CredentialService } from '../src/lib/services/credential-service';

const MASTER_SECRET = 'test-master-secret-with-enough-length-0123456789';
const SECRET = 'sk-casa-secret-8f2b1d';

function corePayload(overrides: Partial<ConnectionsStatusResponse> = {}): ConnectionsStatusResponse {
  return {
    generatedAt: '2026-10-16T00:00:00.000Z',
    storage: 'durable',
    connections: [
      {
        id: 'database.neon',
        name: 'Base de datos (Neon)',
        type: 'database',
        owner: 'system',
        canToggle: false,
        credentialSource: 'system',
        status: 'active',
        detail: 'Dante-AI-Core responde consultas contra la base.',
      },
      {
        id: 'ai.gemini',
        name: 'Google Gemini',
        type: 'ai_provider',
        owner: 'system',
        canToggle: true,
        credentialSource: 'system',
        status: 'active',
        detail: 'Disponible para ejecucion.',
      },
    ],
    ...overrides,
  };
}

describe('Panel de conexiones de La Casa', () => {
  it('1. muestra el estado real cuando el Core esta disponible', () => {
    const panel = composeConnectionsPanel({
      core: corePayload(),
      bridgeReachable: true,
      authConfigured: true,
      generatedAt: '2026-10-16T00:00:00.000Z',
    });

    assert.equal(ConnectionsPanelSchema.safeParse(panel).success, true);
    const byId = new Map(panel.connections.map((c) => [c.id, c]));
    assert.equal(byId.get('bridge.core')?.status, 'active');
    assert.equal(byId.get('auth.supabase')?.status, 'active');
    assert.equal(byId.get('database.neon')?.status, 'active');
    assert.equal(byId.get('ai.gemini')?.status, 'active');
    assert.equal(panel.storage, 'durable');
    assert.equal(panel.bridge.reachable, true);
  });

  it('2. muestra mensajes claros cuando falta configuracion', () => {
    const panel = composeConnectionsPanel({
      core: buildMockCoreConnections({ generatedAt: '2026-10-16T00:00:00.000Z' }),
      bridgeReachable: false,
      bridgeError: 'TIMEOUT',
      authConfigured: false,
    });

    const byId = new Map(panel.connections.map((c) => [c.id, c]));
    assert.equal(panel.storage, 'temporary');
    assert.equal(byId.get('auth.supabase')?.status, 'not_configured');
    assert.equal(byId.get('database.neon')?.status, 'not_configured');
    assert.equal(byId.get('ai.gemini')?.status, 'not_configured');
    assert.equal(byId.get('bridge.core')?.status, 'incomplete');
    for (const connection of panel.connections) {
      if (connection.status === 'not_configured' || connection.status === 'incomplete') {
        assert.ok((connection.detail ?? '').length > 0, 'toda fila no configurada explica el motivo');
      }
    }
  });

  it('3. activar y desactivar un proveedor cambia su estado', () => {
    const disabled = composeConnectionsPanel({
      core: buildMockCoreConnections({ disabled: ['gemini'], configured: ['gemini'] }),
      bridgeReachable: true,
      authConfigured: true,
    });
    const geminiOff = disabled.connections.find((c) => c.id === 'ai.gemini');
    assert.equal(geminiOff?.status, 'disabled');
    assert.equal(geminiOff?.canToggle, true);

    const enabled = composeConnectionsPanel({
      core: buildMockCoreConnections({ configured: ['gemini'] }),
      bridgeReachable: true,
      authConfigured: true,
    });
    assert.equal(enabled.connections.find((c) => c.id === 'ai.gemini')?.status, 'active');

    // groq no tiene adaptador: no es alternable
    assert.equal(disabled.connections.find((c) => c.id === 'ai.groq')?.canToggle, false);
    assert.equal(disabled.connections.find((c) => c.id === 'ai.groq')?.status, 'incomplete');
  });

  it('4. desactivar NO elimina la credencial, solo impide su uso', () => {
    const panel = composeConnectionsPanel({
      core: buildMockCoreConnections({ disabled: ['gemini'], configured: ['gemini'] }),
      bridgeReachable: true,
      authConfigured: true,
    });
    const gemini = panel.connections.find((c) => c.id === 'ai.gemini');

    assert.equal(gemini?.status, 'disabled');
    // La credencial del sistema sigue reportada: no se borro
    assert.equal(gemini?.credentialSource, 'system');

    // Con BYOK del usuario la credencial se conserva y se identifica el origen
    const withByok = composeConnectionsPanel({
      core: buildMockCoreConnections({ disabled: ['gemini'], configured: ['gemini'] }),
      bridgeReachable: true,
      authConfigured: true,
      byokCounts: { gemini: 1 },
    });
    const geminiByok = withByok.connections.find((c) => c.id === 'ai.gemini');
    assert.equal(geminiByok?.status, 'disabled');
    assert.equal(geminiByok?.byokAvailable, true);
    assert.equal(geminiByok?.credentialSource, 'both');
  });

  it('5. un usuario no ve credenciales de otro', async () => {
    const service = new CredentialService(MASTER_SECRET);
    await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });
    await service.save({ ownerId: 'user-b', providerId: 'groq', apiKey: 'sk-otro' });

    const listA = await service.listMetadata('user-a');
    const listB = await service.listMetadata('user-b');
    assert.deepEqual(listA.map((c) => c.providerId), ['gemini']);
    assert.deepEqual(listB.map((c) => c.providerId), ['groq']);

    // El panel solo marca BYOK para el proveedor del propietario consultado
    const countsFor = (list: Array<{ providerId: string }>) => {
      const counts: Record<string, number> = {};
      for (const item of list) counts[item.providerId] = (counts[item.providerId] ?? 0) + 1;
      return counts;
    };

    const panelA = composeConnectionsPanel({
      core: corePayload(),
      bridgeReachable: true,
      authConfigured: true,
      byokCounts: countsFor(listA),
    });
    const panelB = composeConnectionsPanel({
      core: corePayload(),
      bridgeReachable: true,
      authConfigured: true,
      byokCounts: countsFor(listB),
    });

    assert.equal(panelA.connections.find((c) => c.id === 'ai.gemini')?.byokAvailable, true);
    assert.equal(panelB.connections.find((c) => c.id === 'ai.gemini')?.byokAvailable, false);
    assert.equal(panelB.connections.find((c) => c.id === 'ai.groq'), undefined);
  });

  it('6. La Casa no recibe claves, tokens ni URLs internas', () => {
    // Payload del Core contaminado a proposito: el compositor solo copia campos del contrato.
    const polluted = {
      generatedAt: '2026-10-16T00:00:00.000Z',
      storage: 'durable',
      apiKey: SECRET,
      databaseUrl: 'postgres://user:pass@db.internal:5432/neon',
      internalToken: 'internal-bridge-token',
      connections: [
        {
          id: 'ai.gemini',
          name: 'Google Gemini',
          type: 'ai_provider',
          owner: 'system',
          canToggle: true,
          credentialSource: 'system',
          status: 'active',
          detail: 'Disponible para ejecucion.',
          apiKey: SECRET,
          url: 'https://generativelanguage.internal/v1',
        },
      ],
    } as unknown as ConnectionsStatusResponse;

    const panel = composeConnectionsPanel({
      core: polluted,
      bridgeReachable: true,
      authConfigured: true,
    });

    const serialized = JSON.stringify(panel);
    assert.equal(serialized.includes(SECRET), false, 'sin la API key');
    assert.equal(serialized.includes('postgres://'), false, 'sin DATABASE_URL');
    assert.equal(serialized.includes('db.internal'), false, 'sin host interno');
    assert.equal(serialized.includes('internal-bridge-token'), false, 'sin token del bridge');
    assert.equal(serialized.includes('generativelanguage.internal'), false, 'sin URL interna');
    assert.equal(ConnectionsPanelSchema.safeParse(panel).success, true);
  });

  it('7. bridge caido produce un error claro y sanitizado', () => {
    const down = composeConnectionsPanel({
      core: null,
      bridgeReachable: false,
      bridgeError: 'CORE_HTTP_500',
      authConfigured: true,
    });

    assert.equal(down.bridge.reachable, false);
    assert.equal(down.bridge.error, 'Dante-AI-Core respondio con error.');
    const bridgeRow = down.connections.find((c) => c.id === 'bridge.core');
    assert.equal(bridgeRow?.status, 'incomplete');
    assert.equal(bridgeRow?.detail, 'Dante-AI-Core respondio con error.');

    // Nunca se reenvia el error crudo
    const raw = composeConnectionsPanel({
      core: null,
      bridgeReachable: false,
      bridgeError: 'connect ECONNREFUSED 10.0.0.7:443',
      authConfigured: true,
    });
    assert.equal(JSON.stringify(raw).includes('10.0.0.7'), false);
    assert.equal(raw.bridge.error, 'No se pudo contactar a Dante-AI-Core.');

    assert.equal(bridgeErrorMessage(undefined), 'No se pudo contactar a Dante-AI-Core.');
    assert.equal(bridgeErrorMessage('TIMEOUT'), 'Dante-AI-Core no respondio a tiempo.');
    assert.equal(bridgeErrorMessage('CORE_ERROR'), 'Dante-AI-Core devolvio un error.');
  });

  it('el modo mock identifica su estado como temporal', () => {
    const mock = buildMockCoreConnections();
    assert.equal(mock.storage, 'temporary');
    assert.equal(mock.connections.find((c) => c.id === 'ai.mock')?.status, 'active');
    assert.equal(mock.connections.find((c) => c.id === 'database.neon')?.status, 'not_configured');
  });
});
