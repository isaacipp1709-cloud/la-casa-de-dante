import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleChatWithStoredCredentialFromBody,
  handleChatWithCredential,
  type CoreCredentialPort,
  type CredentialHandlerDeps,
} from '../src/lib/services/credential-handlers';
import { CredentialService } from '../src/lib/services/credential-service';
import { DanteBridgeImpl } from '../src/lib/dante-bridge/index';

interface CapturedCoreChatCall {
  ownerId: string;
  credentialId: string;
  messages: Array<{ role: string; content: string }>;
  model?: string;
  conversationId?: string;
}

function createCapturingCore(options: {
  persistence?: 'saved' | 'unavailable' | 'disabled' | string;
} = {}) {
  const calls: CapturedCoreChatCall[] = [];

  const port: CoreCredentialPort = {
    async createCredential() {
      throw new Error('not implemented in test');
    },
    async listCredentials() {
      throw new Error('not implemented in test');
    },
    async deleteCredential() {
      throw new Error('not implemented in test');
    },
    async chatWithStoredCredential(input) {
      calls.push({
        ownerId: input.ownerId,
        credentialId: input.credentialId,
        messages: input.messages,
        model: input.model,
        conversationId: input.conversationId,
      });
      return {
        message: { role: 'assistant', content: 'Respuesta verificada de Dante' },
        status: 'success',
        correlationId: input.conversationId || 'corr-generated',
        providerId: 'gemini',
        model: 'gemini-3.8-flash',
        persistence: options.persistence as any,
      };
    },
  };

  return { port, calls };
}

function createTestDeps(
  authenticatedOwnerId: string,
  core: CoreCredentialPort,
): CredentialHandlerDeps {
  const service = new CredentialService('test-master-secret-32-bytes-length!');
  return {
    resolveOwner: async () => ({ ok: true, ownerId: authenticatedOwnerId }),
    createService: () => service,
    core,
    fallbackEnabled: false,
  };
}

function mockRequest(url = 'http://localhost:3000/api/chat'): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
}

describe('Continuidad y Estado de Persistencia del Chat BYOK', () => {
  it('1. Dos turnos del mismo hilo transmiten el mismo conversationId al Core', async () => {
    const { port, calls } = createCapturingCore({ persistence: 'saved' });
    const deps = createTestDeps('owner-isaac', port);

    // Turno 1
    const res1 = await handleChatWithStoredCredentialFromBody(
      mockRequest(),
      {
        credentialId: 'cred-123',
        conversationId: 'thread-persistent-uuid-1',
        messages: [{ role: 'user', content: 'Primer mensaje' }],
      },
      deps,
    );
    assert.equal(res1.status, 200);

    // Turno 2
    const res2 = await handleChatWithStoredCredentialFromBody(
      mockRequest(),
      {
        credentialId: 'cred-123',
        conversationId: 'thread-persistent-uuid-1',
        messages: [
          { role: 'user', content: 'Primer mensaje' },
          { role: 'assistant', content: 'Respuesta 1' },
          { role: 'user', content: 'Segundo mensaje' },
        ],
      },
      deps,
    );
    assert.equal(res2.status, 200);

    assert.equal(calls.length, 2);
    assert.equal(
      calls[0].conversationId,
      'thread-persistent-uuid-1',
      'El turno 1 debe enviar conversationId al Core',
    );
    assert.equal(
      calls[1].conversationId,
      'thread-persistent-uuid-1',
      'El turno 2 debe enviar el mismo conversationId al Core',
    );
  });

  it('2. Soporta sessionId como fallback si conversationId no viene explícito', async () => {
    const { port, calls } = createCapturingCore({ persistence: 'saved' });
    const deps = createTestDeps('owner-isaac', port);

    const res = await handleChatWithStoredCredentialFromBody(
      mockRequest(),
      {
        credentialId: 'cred-123',
        sessionId: 'session-from-client-shell',
        messages: [{ role: 'user', content: 'Hola Dante' }],
      },
      deps,
    );
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].conversationId,
      'session-from-client-shell',
      'Debe propagar sessionId como conversationId si este no fue provisto',
    );
  });

  it('3. ownerId continúa siendo el autenticado y NUNCA el del body', async () => {
    const { port, calls } = createCapturingCore({ persistence: 'saved' });
    const deps = createTestDeps('real-authenticated-owner-uuid', port);

    const res = await handleChatWithStoredCredentialFromBody(
      mockRequest(),
      {
        credentialId: 'cred-123',
        ownerId: 'malicious-injected-owner',
        userId: 'malicious-injected-user',
        conversationId: 'thread-abc',
        messages: [{ role: 'user', content: 'Intento de spoofing' }],
      },
      deps,
    );
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].ownerId,
      'real-authenticated-owner-uuid',
      'El Core debe recibir el ownerId de la sesion autenticada, no del body',
    );
  });

  it('4. saved, unavailable y disabled llegan correctamente a la respuesta', async () => {
    for (const status of ['saved', 'unavailable', 'disabled'] as const) {
      const { port } = createCapturingCore({ persistence: status });
      const deps = createTestDeps('owner-isaac', port);

      const res = await handleChatWithStoredCredentialFromBody(
        mockRequest(),
        {
          credentialId: 'cred-123',
          conversationId: 'thread-xyz',
          messages: [{ role: 'user', content: 'Mensaje' }],
        },
        deps,
      );
      assert.equal(res.status, 200);
      assert.equal(
        res.body.persistence,
        status,
        `La respuesta debe propagar persistence='${status}'`,
      );
    }
  });

  it('5. Un estado ausente o inválido de persistence NO se convierte en saved', async () => {
    // Caso 1: Ausente
    {
      const { port } = createCapturingCore({ persistence: undefined });
      const deps = createTestDeps('owner-isaac', port);
      const res = await handleChatWithStoredCredentialFromBody(
        mockRequest(),
        {
          credentialId: 'cred-123',
          conversationId: 'thread-xyz',
          messages: [{ role: 'user', content: 'Mensaje' }],
        },
        deps,
      );
      assert.equal(res.status, 200);
      assert.notEqual(
        res.body.persistence,
        'saved',
        'No se debe inventar "saved" cuando el Core no informa persistencia',
      );
    }

    // Caso 2: Inválido
    {
      const { port } = createCapturingCore({ persistence: 'invented_or_unknown_status' });
      const deps = createTestDeps('owner-isaac', port);
      const res = await handleChatWithStoredCredentialFromBody(
        mockRequest(),
        {
          credentialId: 'cred-123',
          conversationId: 'thread-xyz',
          messages: [{ role: 'user', content: 'Mensaje' }],
        },
        deps,
      );
      assert.equal(res.status, 200);
      assert.notEqual(
        res.body.persistence,
        'saved',
        'No se debe convertir un valor invalido en "saved"',
      );
      assert.equal(
        res.body.persistence,
        undefined,
        'Un valor invalido de persistence debe descartarse',
      );
    }
  });

  it('6. El flujo sin credencial sigue rechazándose', async () => {
    const { port } = createCapturingCore({ persistence: 'saved' });
    const deps = createTestDeps('owner-isaac', port);

    // Sin credentialId
    const res = await handleChatWithStoredCredentialFromBody(
      mockRequest(),
      {
        conversationId: 'thread-xyz',
        messages: [{ role: 'user', content: 'Mensaje sin credencial' }],
      },
      deps,
    );
    assert.equal(res.status, 400);
    assert.equal((res.body.error as any)?.code, 'INVALID_REQUEST');

    // Con credentialId vacío
    const resEmpty = await handleChatWithStoredCredentialFromBody(
      mockRequest(),
      {
        credentialId: '   ',
        conversationId: 'thread-xyz',
        messages: [{ role: 'user', content: 'Mensaje con credencial vacía' }],
      },
      deps,
    );
    assert.equal(resEmpty.status, 400);
  });

  it('7. Callers existentes sin conversationId no se rompen (backward compatibility)', async () => {
    const { port, calls } = createCapturingCore({ persistence: 'saved' });
    const deps = createTestDeps('owner-isaac', port);

    const res = await handleChatWithStoredCredentialFromBody(
      mockRequest(),
      {
        credentialId: 'cred-123',
        messages: [{ role: 'user', content: 'Mensaje legacy sin conversationId' }],
      },
      deps,
    );
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(res.body.status, 'success');
    assert.ok(res.body.message);
  });

  it('8. handleChatWithCredential (POST /api/chat/credentials) también propaga conversationId y persistence', async () => {
    const { port, calls } = createCapturingCore({ persistence: 'saved' });
    const deps = createTestDeps('owner-isaac', port);

    const req = new Request('http://localhost:3000/api/chat/credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        credentialId: 'cred-123',
        conversationId: 'thread-credentials-endpoint',
        messages: [{ role: 'user', content: 'Mensaje' }],
      }),
    });

    const res = await handleChatWithCredential(req, deps);
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].conversationId, 'thread-credentials-endpoint');
    assert.equal(res.body.persistence, 'saved');
  });

  it('9. DanteBridgeImpl propaga X-Conversation-ID y la aserción firmada en postToDanteCore', async () => {
    const hadToken = 'DANTE_CORE_TOKEN' in process.env;
    const originalToken = process.env.DANTE_CORE_TOKEN;
    process.env.DANTE_CORE_TOKEN = 'test-core-token-continuity';

    let capturedHeaders: Record<string, string> = {};
    const originalFetch = global.fetch;

    try {
      global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        capturedHeaders = (init?.headers as Record<string, string>) || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'resp-uuid-1',
            model: 'gemini-3.8-flash',
            conversationId: 'thread-bridge-test-1',
            choices: [{ message: { role: 'assistant', content: 'Respuesta Bridge' } }],
            persistence: 'saved',
          }),
        } as unknown as Response;
      }) as typeof global.fetch;

      const bridge = new DanteBridgeImpl();
      const res = await bridge.chatWithStoredCredential({
        ownerId: 'owner-test-uuid',
        credentialId: 'cred-test-1',
        conversationId: 'thread-bridge-test-1',
        messages: [{ role: 'user', content: 'Hola puente' }],
      });

      assert.equal(capturedHeaders['X-Conversation-ID'], 'thread-bridge-test-1');
      assert.ok(capturedHeaders['x-dante-owner-assertion'], 'Debe enviar cabecera firmada HMAC x-dante-owner-assertion');
      assert.equal(res.persistence, 'saved');
      assert.equal(res.correlationId, 'thread-bridge-test-1');
    } finally {
      if (typeof originalFetch === 'function') {
        global.fetch = originalFetch;
      } else {
        delete (global as any).fetch;
      }
      if (hadToken) {
        process.env.DANTE_CORE_TOKEN = originalToken;
      } else {
        delete process.env.DANTE_CORE_TOKEN;
      }
    }
  });

  it('10. DanteBridgeImpl genera identificadores únicos distintos cuando no se envía conversationId (sin colisiones)', async () => {
    const hadToken = 'DANTE_CORE_TOKEN' in process.env;
    const originalToken = process.env.DANTE_CORE_TOKEN;
    process.env.DANTE_CORE_TOKEN = 'test-core-token-continuity';

    const capturedIds: string[] = [];
    const originalFetch = global.fetch;

    try {
      global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        const headers = (init?.headers as Record<string, string>) || {};
        if (headers['X-Conversation-ID']) {
          capturedIds.push(headers['X-Conversation-ID']);
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'resp-uuid-auto',
            model: 'gemini-3.8-flash',
            choices: [{ message: { role: 'assistant', content: 'Respuesta Bridge' } }],
            persistence: 'unavailable',
          }),
        } as unknown as Response;
      }) as typeof global.fetch;

      const bridge = new DanteBridgeImpl();

      // Solicitud 1 sin ID
      await bridge.chatWithStoredCredential({
        ownerId: 'owner-test-uuid',
        credentialId: 'cred-test-1',
        messages: [{ role: 'user', content: 'Mensaje 1 sin ID' }],
      });

      // Solicitud 2 sin ID
      await bridge.chatWithStoredCredential({
        ownerId: 'owner-test-uuid',
        credentialId: 'cred-test-1',
        messages: [{ role: 'user', content: 'Mensaje 2 sin ID' }],
      });

      assert.equal(capturedIds.length, 2, 'Debe haber capturado 2 identificadores en X-Conversation-ID');
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      assert.match(capturedIds[0], uuidRegex, 'El ID de la primera solicitud debe ser un UUID v4 criptográfico');
      assert.match(capturedIds[1], uuidRegex, 'El ID de la segunda solicitud debe ser un UUID v4 criptográfico');
      assert.notEqual(
        capturedIds[0],
        capturedIds[1],
        'Dos solicitudes sin conversationId deben generar identificadores distintos (prevención de colisiones)',
      );
    } finally {
      if (typeof originalFetch === 'function') {
        global.fetch = originalFetch;
      } else {
        delete (global as any).fetch;
      }
      if (hadToken) {
        process.env.DANTE_CORE_TOKEN = originalToken;
      } else {
        delete process.env.DANTE_CORE_TOKEN;
      }
    }
  });

  it('11. DanteBridgeImpl descarta estados no reconocidos de persistence', async () => {
    const hadToken = 'DANTE_CORE_TOKEN' in process.env;
    const originalToken = process.env.DANTE_CORE_TOKEN;
    process.env.DANTE_CORE_TOKEN = 'test-core-token-continuity';

    const originalFetch = global.fetch;

    try {
      global.fetch = (async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'resp-uuid-3',
            model: 'gemini-3.8-flash',
            choices: [{ message: { role: 'assistant', content: 'Respuesta Bridge' } }],
            persistence: 'fake_persistence_status',
          }),
        } as unknown as Response;
      }) as typeof global.fetch;

      const bridge = new DanteBridgeImpl();
      const res = await bridge.chatWithStoredCredential({
        ownerId: 'owner-test-uuid',
        credentialId: 'cred-test-1',
        messages: [{ role: 'user', content: 'Prueba valor inválido' }],
      });

      assert.equal(res.persistence, undefined, 'Persistence desconocido debe mapearse a undefined');
    } finally {
      if (typeof originalFetch === 'function') {
        global.fetch = originalFetch;
      } else {
        delete (global as any).fetch;
      }
      if (hadToken) {
        process.env.DANTE_CORE_TOKEN = originalToken;
      } else {
        delete process.env.DANTE_CORE_TOKEN;
      }
    }
  });
});
