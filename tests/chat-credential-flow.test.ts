// Chat con credencial almacenada: /api/chat acepta credentialId y ejecuta el proveedor.
//
// LIMITACION EXPLICITA: se usa un adaptador falso inyectado. No hay llamadas reales
// a Gemini ni uso de claves reales; solo se verifica el cableado y la seguridad.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DanteChatResponseSchema, DanteChatRequestSchema } from '../src/contracts/dante';
import { CredentialService } from '../src/lib/services/credential-service';
import {
  handleChatWithStoredCredential,
  rejectClientSuppliedApiKey,
  type CredentialHandlerDeps,
} from '../src/lib/services/credential-handlers';
import {
  createProviderDispatch,
  type ProviderDispatchInput,
} from '../src/lib/services/provider-dispatch';
import { ProviderUnsupportedError } from '../src/lib/services/provider-errors';

const MASTER_SECRET = 'test-master-secret-with-enough-length-0123456789';
const SECRET = 'sk-chat-credential-value-7b2e4d';

function chatRequest(body: unknown): Request {
  return new Request('http://local/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function depsFor(
  ownerId: string,
  service: CredentialService,
  dispatch: CredentialHandlerDeps['dispatch'],
): CredentialHandlerDeps {
  return {
    resolveOwner: async () => ({ ok: true, ownerId }),
    createService: () => service,
    fallbackEnabled: true,
    dispatch,
  };
}

describe('Chat con credentialId', () => {
  it('1. /api/chat acepta credentialId y responde con el contrato de chat', async () => {
    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });
    const dispatch = createProviderDispatch({ gemini: async () => ({ content: 'respuesta de gemini' }) });

    const response = await handleChatWithStoredCredential(
      chatRequest({ messages: [{ role: 'user', content: 'hola' }], credentialId: metadata.credentialId }),
      depsFor('user-a', service, dispatch),
    );

    assert.equal(response.status, 200);
    const parsed = DanteChatResponseSchema.safeParse(response.body);
    assert.equal(parsed.success, true, 'la respuesta cumple DanteChatResponseSchema');
  });

  it('2. resuelve la credencial del propietario correcto y llega al adaptador con la clave resuelta', async () => {
    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });

    const captured: ProviderDispatchInput[] = [];
    const dispatch = createProviderDispatch({
      gemini: async (input) => { captured.push(input); return { content: 'ok' }; },
    });

    const response = await handleChatWithStoredCredential(
      chatRequest({
        messages: [{ role: 'user', content: 'hola' }],
        credentialId: metadata.credentialId,
        model: 'gemini-2.0-flash',
      }),
      depsFor('user-a', service, dispatch),
    );

    assert.equal(response.status, 200);
    assert.equal(captured.length, 1, 'el adaptador gemini fue invocado');
    assert.equal(captured[0].apiKey, SECRET, 'recibe la clave descifrada de su propia credencial');
    assert.equal(captured[0].providerId, 'gemini');
    assert.equal(captured[0].model, 'gemini-2.0-flash');
  });

  it('3. rechaza la credencial de otro usuario con el mismo error generico', async () => {
    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });

    let called = false;
    const dispatch = createProviderDispatch({
      gemini: async () => { called = true; return { content: 'no debe ejecutarse' }; },
    });

    const response = await handleChatWithStoredCredential(
      chatRequest({ messages: [{ role: 'user', content: 'hola' }], credentialId: metadata.credentialId }),
      depsFor('user-b', service, dispatch),
    );

    assert.equal(response.status, 404);
    assert.equal((response.body.error as Record<string, unknown>).code, 'NOT_FOUND');
    assert.equal(called, false);
    assert.ok(!JSON.stringify(response.body).includes(SECRET));
  });

  it('4. rechaza una API key enviada desde el cliente', async () => {
    const body = { messages: [{ role: 'user', content: 'hola' }], apiKey: 'sk-from-browser' };
    const rejected = rejectClientSuppliedApiKey(body as Record<string, unknown>);
    assert.ok(rejected, 'el guard rechaza la clave del cliente');
    assert.equal(rejected?.status, 400);
    assert.equal((rejected?.body.error as Record<string, unknown>).code, 'INVALID_REQUEST');

    assert.equal(rejectClientSuppliedApiKey({ messages: [] }), null, 'sin clave no hay rechazo');
    assert.equal(rejectClientSuppliedApiKey({ apiKey: '   ' }), null, 'clave vacia no cuenta');

    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });
    let called = false;
    const dispatch = createProviderDispatch({ gemini: async () => { called = true; return { content: 'x' }; } });

    const response = await handleChatWithStoredCredential(
      chatRequest({ ...body, credentialId: metadata.credentialId }),
      depsFor('user-a', service, dispatch),
    );
    assert.equal(response.status, 400);
    assert.equal(called, false, 'no se ejecuta el proveedor con una clave enviada por el cliente');
  });

  it('5. el flujo llega al adaptador gemini cableado en el runtime', async () => {
    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });

    const captured: string[] = [];
    const dispatch = createProviderDispatch({
      gemini: async (input) => { captured.push(input.apiKey); return { content: 'ok' }; },
      ollama: async () => { throw new ProviderUnsupportedError(); },
    });

    const ok = await handleChatWithStoredCredential(
      chatRequest({ messages: [{ role: 'user', content: 'hola' }], credentialId: metadata.credentialId }),
      depsFor('user-a', service, dispatch),
    );
    assert.equal(ok.status, 200);
    assert.deepEqual(captured, [SECRET]);

    // proveedor sin adaptador -> error explicito, sin mock
    const groqCredential = await service.save({ ownerId: 'user-a', providerId: 'groq', apiKey: 'sk-groq' });
    const unsupported = await handleChatWithStoredCredential(
      chatRequest({ messages: [{ role: 'user', content: 'hola' }], credentialId: groqCredential.credentialId }),
      depsFor('user-a', service, dispatch),
    );
    assert.equal(unsupported.status, 501);
    assert.equal((unsupported.body.error as Record<string, unknown>).code, 'PROVIDER_NOT_SUPPORTED');
  });

  it('6. la respuesta identifica proveedor y modelo y nunca incluye la clave', async () => {
    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });
    const dispatch = createProviderDispatch({ gemini: async () => ({ content: 'respuesta' }) });

    const response = await handleChatWithStoredCredential(
      chatRequest({
        messages: [{ role: 'user', content: 'hola' }],
        credentialId: metadata.credentialId,
        model: 'gemini-2.5-flash',
      }),
      depsFor('user-a', service, dispatch),
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.providerId, 'gemini');
    assert.equal(response.body.model, 'gemini-2.5-flash');
    assert.equal(response.body.status, 'success');
    assert.ok(typeof response.body.correlationId === 'string');

    const serialized = JSON.stringify(response.body);
    assert.ok(!serialized.includes(SECRET), 'la clave no aparece en la respuesta');
    assert.ok(!serialized.toLowerCase().includes('apikey'));
    assert.ok(!serialized.toLowerCase().includes('ciphertext'));
  });

  it('el contrato del request transporta credentialId', () => {
    const parsed = DanteChatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'hola' }],
      providerId: 'gemini',
      credentialId: 'cred-1',
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.credentialId, 'cred-1');
      assert.equal('apiKey' in parsed.data, false);
    }
  });
});
