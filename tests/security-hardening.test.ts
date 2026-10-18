// Endurecimiento del recorrido: contrato cruzado REAL Casa->Core y cabeceras firmadas.
//
// LIMITACION: sin servicios externos. El unico "transporte" es la llamada directa
// entre las implementaciones reales de firma (La Casa) y verificacion (el Core).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { signOwnerAssertion, ownerAssertionHeaders, OWNER_ASSERTION_HEADER } from '../src/lib/credentials/owner-assertion';
import { buildCoreChatHeaders, OwnerIdentityRequiredError } from '../src/lib/dante-bridge/chat-headers';
import { verifyOwnerAssertion } from '../../Dante-AI-Core/src/lib/owner-assertion';

const TOKEN = 'bridge-token-de-prueba-suficientemente-largo';

describe('Contrato cruzado Casa -> Core (implementaciones reales)', () => {
  it('una asercion firmada por La Casa es aceptada por el Core', () => {
    const assertion = signOwnerAssertion('user-isaac', { secret: TOKEN });
    assert.ok(assertion);

    const result = verifyOwnerAssertion({ assertion, secret: TOKEN });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.ownerId, 'user-isaac', 'la identidad proviene de la firma');
  });

  it('rechaza asercion ausente, alterada, vencida o con otro secreto', () => {
    const good = signOwnerAssertion('user-isaac', { secret: TOKEN, ttlMs: 60_000 });
    assert.ok(good);
    const [payload, signature] = String(good).split('.');

    assert.equal(verifyOwnerAssertion({ assertion: null, secret: TOKEN }).ok, false, 'ausente');
    assert.equal(
      verifyOwnerAssertion({
        assertion: payload + '.' + signature.slice(0, -2) + 'ab',
        secret: TOKEN,
      }).ok,
      false,
      'firma alterada',
    );
    assert.equal(
      verifyOwnerAssertion({ assertion: signOwnerAssertion('user-isaac', { secret: TOKEN, ttlMs: -1000 }), secret: TOKEN }).ok,
      false,
      'vencida',
    );
    assert.equal(
      verifyOwnerAssertion({ assertion: signOwnerAssertion('user-isaac', { secret: 'otro-secreto-largo-000000' }), secret: TOKEN }).ok,
      false,
      'otro secreto',
    );

    // Payload suplantado con la firma original: el Core no lo acepta
    const forgedPayload = Buffer.from(
      JSON.stringify({ ownerId: 'atacante', iat: 0, exp: Date.now() + 60_000 }),
      'utf8',
    ).toString('base64url');
    assert.equal(
      verifyOwnerAssertion({ assertion: forgedPayload + '.' + signature, secret: TOKEN }).ok,
      false,
      'payload suplantado',
    );
  });

  it('el Core no acepta identidad sin secreto configurado', () => {
    const result = verifyOwnerAssertion({ assertion: signOwnerAssertion('user-isaac', { secret: TOKEN }), secret: undefined });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'CONFIGURATION_ERROR');
  });
});

describe('Cabeceras del chat hacia el Core', () => {
  it('llevan la asercion firmada y NUNCA X-User-ID', () => {
    process.env.DANTE_CORE_TOKEN = TOKEN;
    const headers = buildCoreChatHeaders({
      verifiedOwnerId: 'user-isaac',
      conversationId: 'conv-1',
      timezone: 'America/Santiago',
      locale: 'es-CL',
    });

    assert.ok(headers[OWNER_ASSERTION_HEADER], 'incluye la asercion');
    assert.equal(/x-user-id/i.test(Object.keys(headers).join(',')), false, 'sin X-User-ID');
    assert.equal(headers['X-Conversation-ID'], 'conv-1');

    const verified = verifyOwnerAssertion({ assertion: headers[OWNER_ASSERTION_HEADER], secret: TOKEN });
    assert.equal(verified.ok, true);
    if (verified.ok) assert.equal(verified.ownerId, 'user-isaac');
    delete process.env.DANTE_CORE_TOKEN;
  });

  it('sin secreto de firma la operacion se rechaza en vez de degradar', () => {
    delete process.env.DANTE_CORE_TOKEN;
    assert.throws(
      () => buildCoreChatHeaders({ verifiedOwnerId: 'user-isaac', conversationId: 'conv-1' }),
      OwnerIdentityRequiredError,
    );
  });

  it('la identidad del navegador no participa: solo el ownerId verificado', () => {
    process.env.DANTE_CORE_TOKEN = TOKEN;
    const forged = buildCoreChatHeaders({ verifiedOwnerId: 'user-isaac', conversationId: 'conv-1' });
    const verified = verifyOwnerAssertion({ assertion: forged[OWNER_ASSERTION_HEADER], secret: TOKEN });
    assert.equal(verified.ok, true);
    if (verified.ok) assert.equal(verified.ownerId, 'user-isaac');
    assert.equal(JSON.stringify(forged).includes('atacante'), false);
    delete process.env.DANTE_CORE_TOKEN;
  });
});

describe('Integracion local Casa -> Core (handlers reales, transporte controlado)', () => {
  it('el handler de La Casa ejecuta el turno real del Core una sola vez', async () => {
    const { handleChatWithStoredCredentialFromBody } = await import('../src/lib/services/credential-handlers');
    const { runByokChatTurn } = await import('../../Dante-AI-Core/src/orchestrator/credentials/byok-turn');

    let executions = 0;
    const corePort = {
      createCredential: async () => { throw new Error('no usado en esta prueba'); },
      listCredentials: async () => { throw new Error('no usado en esta prueba'); },
      deleteCredential: async () => { throw new Error('no usado en esta prueba'); },
      chatWithStoredCredential: async (input: {
        ownerId: string;
        credentialId: string;
        messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      }) => {
        const turn = await runByokChatTurn({
          providerId: 'gemini',
          apiKey: 'clave-solo-executor',
          messages: input.messages,
          financialContext: { userId: input.ownerId },
          disabledProviders: [],
          routerEnabled: true,
          executor: async () => {
            executions += 1;
            return { content: 'respuesta de Dante', model: 'gemini-1.5-flash' };
          },
        });
        if (turn.status !== 'ok') throw new Error('CORE_HTTP_403');
        return {
          message: { role: 'assistant' as const, content: turn.content },
          status: 'success' as const,
          correlationId: 'corr-integracion',
          providerId: 'gemini',
          model: turn.model,
        };
      },
    };

    const result = await handleChatWithStoredCredentialFromBody(
      new Request('http://local/api/chat', { method: 'POST' }),
      { credentialId: 'cred-1', messages: [{ role: 'user', content: 'hola Dante' }] },
      {
        resolveOwner: async () => ({ ok: true, ownerId: 'user-isaac' }),
        createService: () => { throw new Error('no debe usar la boveda local'); },
        core: corePort,
      },
    );

    assert.equal(result.status, 200);
    const body = result.body as { message: { content: string }; providerId?: string };
    assert.equal(body.message.content, 'respuesta de Dante');
    assert.equal(body.providerId, 'gemini');
    assert.equal(executions, 1, 'una sola ejecucion del proveedor');
    assert.equal(JSON.stringify(result.body).includes('clave-solo-executor'), false);
  });

  it('guardrail del orquestador: el ejecutor no se invoca', async () => {
    const { handleChatWithStoredCredentialFromBody } = await import('../src/lib/services/credential-handlers');
    const { runByokChatTurn } = await import('../../Dante-AI-Core/src/orchestrator/credentials/byok-turn');

    let executions = 0;
    const corePort = {
      createCredential: async () => { throw new Error('no usado en esta prueba'); },
      listCredentials: async () => { throw new Error('no usado en esta prueba'); },
      deleteCredential: async () => { throw new Error('no usado en esta prueba'); },
      chatWithStoredCredential: async (input: { ownerId: string; messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> }) => {
        const turn = await runByokChatTurn({
          providerId: 'gemini',
          apiKey: 'clave-solo-executor',
          messages: input.messages,
          financialContext: { userId: input.ownerId },
          disabledProviders: [],
          routerEnabled: true,
          executor: async () => {
            executions += 1;
            return { content: 'no deberia', model: 'm' };
          },
        });
        return {
          message: { role: 'assistant' as const, content: turn.content },
          status: 'success' as const,
          correlationId: 'corr-guardrail',
        };
      },
    };

    const result = await handleChatWithStoredCredentialFromBody(
      new Request('http://local/api/chat', { method: 'POST' }),
      { credentialId: 'cred-1', messages: [{ role: 'user', content: 'vacas vuelan' }] },
      {
        resolveOwner: async () => ({ ok: true, ownerId: 'user-isaac' }),
        createService: () => { throw new Error('sin boveda local'); },
        core: corePort,
      },
    );

    assert.equal(result.status, 200);
    assert.equal(executions, 0, 'el guardrail bloquea antes del proveedor');
  });

  it('getConversations y toggleProviderConnection propagan la asercion firmada del propietario', async () => {
    process.env.DANTE_CORE_TOKEN = TOKEN;
    process.env.DANTE_MODE = 'local-core';
    process.env.DANTE_CORE_URL = 'http://127.0.0.1:3001';

    let capturedToggleHeaders: Record<string, string> | undefined;
    let capturedConvHeaders: Record<string, string> | undefined;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/connections/providers/toggle')) {
        capturedToggleHeaders = init?.headers as Record<string, string>;
        return new Response(JSON.stringify({
          mode: 'ready',
          timestamp: new Date().toISOString(),
          database: { connected: true, latencyMs: 5 },
          providers: [{ id: 'gemini', name: 'Google Gemini', enabled: true, routable: true, configured: true, missingKeys: [] }],
          auth: { configured: true, mode: 'token', details: 'OK' },
          storage: 'durable',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/api/conversations')) {
        capturedConvHeaders = init?.headers as Record<string, string>;
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(input, init);
    };

    try {
      const { danteBridge } = await import('../src/lib/dante-bridge');
      await danteBridge.toggleProviderConnection('gemini', true, 'user-isaac');
      assert.ok(capturedToggleHeaders?.[OWNER_ASSERTION_HEADER], 'toggle envia cabecera de asercion');
      const toggleVerified = verifyOwnerAssertion({
        assertion: capturedToggleHeaders[OWNER_ASSERTION_HEADER],
        secret: TOKEN,
      });
      assert.equal(toggleVerified.ok, true);
      if (toggleVerified.ok) assert.equal(toggleVerified.ownerId, 'user-isaac');

      await danteBridge.getConversations('user-isaac');
      assert.ok(capturedConvHeaders?.[OWNER_ASSERTION_HEADER], 'getConversations envia cabecera de asercion');
      const convVerified = verifyOwnerAssertion({
        assertion: capturedConvHeaders[OWNER_ASSERTION_HEADER],
        secret: TOKEN,
      });
      assert.equal(convVerified.ok, true);
      if (convVerified.ok) assert.equal(convVerified.ownerId, 'user-isaac');
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.DANTE_CORE_TOKEN;
      delete process.env.DANTE_MODE;
      delete process.env.DANTE_CORE_URL;
    }
  });
});
