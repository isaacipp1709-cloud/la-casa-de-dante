// BYOK: resolucion de credentialId hasta el adaptador del proveedor y errores tipados.
//
// LIMITACION EXPLICITA: los adaptadores usados aqui son falsos (inyectados) y no se
// realiza ninguna llamada real a Gemini, Groq u otro servicio externo. El adaptador
// real de gemini se verifica como cableado, no como llamada de red.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CredentialService } from '../src/lib/services/credential-service';
import {
  handleChatWithCredential,
  type CredentialHandlerDeps,
} from '../src/lib/services/credential-handlers';
import {
  createProviderDispatch,
  SUPPORTED_PROVIDERS,
  type ProviderDispatchInput,
} from '../src/lib/services/provider-dispatch';
import { defaultProviderAdapters } from '../src/lib/services/provider-adapters';
import {
  classifyProviderError,
  ProviderAuthError,
  ProviderNetworkError,
  ProviderRateLimitError,
  ProviderResponseError,
  ProviderTimeoutError,
} from '../src/lib/services/provider-errors';

const MASTER_SECRET = 'test-master-secret-with-enough-length-0123456789';
const SECRET = 'sk-byok-credential-value-3f9c1a';

function jsonRequest(body: unknown): Request {
  return new Request('http://local/api/chat/credentials', {
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
  return { resolveOwner: async () => ({ ok: true, ownerId }), createService: () => service, dispatch, fallbackEnabled: true };
}

describe('BYOK: resolucion de credencial hasta el proveedor', () => {
  it('1. resuelve credentialId y entrega la clave solo al adaptador del proveedor', async () => {
    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });

    const captured: ProviderDispatchInput[] = [];
    const dispatch = createProviderDispatch({
      gemini: async (input) => { captured.push(input); return { content: 'respuesta real del adaptador' }; },
    });

    const response = await handleChatWithCredential(
      jsonRequest({
        credentialId: metadata.credentialId,
        model: 'gemini-3.8-flash',
        messages: [{ role: 'user', content: 'hola' }],
      }),
      depsFor('user-a', service, dispatch),
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.content, 'respuesta real del adaptador');
    assert.equal(response.body.providerId, 'gemini');
    assert.equal(response.body.usedCredential, true);
    assert.equal(captured.length, 1);
    assert.equal(captured[0].apiKey, SECRET, 'la clave descifrada llega al adaptador');
    assert.equal(captured[0].providerId, 'gemini');
    assert.equal(captured[0].model, 'gemini-3.8-flash');
    assert.deepEqual(captured[0].messages, [{ role: 'user', content: 'hola' }]);
  });

  it('el adaptador real de gemini esta conectado y los no soportados no tienen adaptador', () => {
    assert.ok(SUPPORTED_PROVIDERS.includes('gemini'));
    assert.equal(typeof defaultProviderAdapters.gemini, 'function');
    assert.equal(defaultProviderAdapters.ollama, undefined);
    assert.equal(defaultProviderAdapters.groq, undefined);
  });

  it('2. rechaza la credencial de otro usuario sin invocar al adaptador', async () => {
    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });

    let called = false;
    const dispatch = createProviderDispatch({
      gemini: async () => { called = true; return { content: 'no debe ejecutarse' }; },
    });

    const response = await handleChatWithCredential(
      jsonRequest({ credentialId: metadata.credentialId, messages: [{ role: 'user', content: 'hola' }] }),
      depsFor('user-b', service, dispatch),
    );

    assert.equal(response.status, 404);
    assert.equal((response.body.error as Record<string, unknown>).code, 'NOT_FOUND');
    assert.equal(called, false);
  });

  it('3. rechaza un proveedor no soportado con el despachador real', async () => {
    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'ollama', apiKey: SECRET });

    const realDispatch = createProviderDispatch(defaultProviderAdapters);
    const response = await handleChatWithCredential(
      jsonRequest({ credentialId: metadata.credentialId, messages: [{ role: 'user', content: 'hola' }] }),
      depsFor('user-a', service, realDispatch),
    );

    assert.equal(response.status, 501);
    assert.equal((response.body.error as Record<string, unknown>).code, 'PROVIDER_NOT_SUPPORTED');
    assert.ok(!JSON.stringify(response.body).includes(SECRET));
  });
});

describe('BYOK: errores del proveedor sanitizados', () => {
  it('4. traduce cada fallo a su codigo sin exponer la clave ni detalles internos', async () => {
    const cases: Array<[Error, number, string]> = [
      [new ProviderAuthError(), 401, 'PROVIDER_UNAUTHORIZED'],
      [new ProviderRateLimitError(), 429, 'PROVIDER_RATE_LIMITED'],
      [new ProviderTimeoutError(), 504, 'PROVIDER_TIMEOUT'],
      [new ProviderNetworkError(), 502, 'PROVIDER_NETWORK_ERROR'],
      [new ProviderResponseError(), 502, 'PROVIDER_ERROR'],
    ];

    for (const [failure, expectedStatus, expectedCode] of cases) {
      const service = new CredentialService(MASTER_SECRET);
      const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });
      const dispatch = createProviderDispatch({
        gemini: async () => { throw failure; },
      });

      const response = await handleChatWithCredential(
        jsonRequest({ credentialId: metadata.credentialId, messages: [{ role: 'user', content: 'hola' }] }),
        depsFor('user-a', service, dispatch),
      );

      assert.equal(response.status, expectedStatus, failure.name);
      assert.equal((response.body.error as Record<string, unknown>).code, expectedCode);
    }
  });

  it('no filtra mensajes crudos del upstream (clave ni URL interna)', async () => {
    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });

    const rawUpstreamError = Object.assign(
      new Error('upstream https://generativelanguage.internal/v1 failed with key ' + SECRET),
      { status: 429 },
    );
    const dispatch = createProviderDispatch({
      gemini: async () => { throw classifyProviderError(rawUpstreamError); },
    });

    const response = await handleChatWithCredential(
      jsonRequest({ credentialId: metadata.credentialId, messages: [{ role: 'user', content: 'hola' }] }),
      depsFor('user-a', service, dispatch),
    );

    assert.equal(response.status, 429);
    assert.equal((response.body.error as Record<string, unknown>).code, 'PROVIDER_RATE_LIMITED');
    const serialized = JSON.stringify(response.body);
    assert.ok(!serialized.includes(SECRET), 'sin la clave');
    assert.ok(!serialized.includes('internal'), 'sin URLs internas');
  });

  it('clasifica errores crudos del SDK correctamente', () => {
    assert.ok(classifyProviderError({ status: 400 }) instanceof ProviderAuthError);
    assert.ok(classifyProviderError({ status: 403 }) instanceof ProviderAuthError);
    assert.ok(classifyProviderError({ status: 429 }) instanceof ProviderRateLimitError);
    assert.ok(classifyProviderError({ code: 'ETIMEDOUT' }) instanceof ProviderTimeoutError);
    assert.ok(classifyProviderError({ code: 'ECONNREFUSED' }) instanceof ProviderNetworkError);
    assert.ok(classifyProviderError(new Error('boom')) instanceof ProviderResponseError);
  });

  it('5. la clave no aparece en ninguna respuesta correcta', async () => {
    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });
    const dispatch = createProviderDispatch({ gemini: async () => ({ content: 'ok' }) });

    const response = await handleChatWithCredential(
      jsonRequest({ credentialId: metadata.credentialId, messages: [{ role: 'user', content: 'hola' }] }),
      depsFor('user-a', service, dispatch),
    );

    assert.equal(response.status, 200);
    const serialized = JSON.stringify(response.body);
    assert.ok(!serialized.includes(SECRET));
    assert.ok(!serialized.toLowerCase().includes('apikey'));
    assert.ok(!serialized.toLowerCase().includes('ciphertext'));
  });
});
