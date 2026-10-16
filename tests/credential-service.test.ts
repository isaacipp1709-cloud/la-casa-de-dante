// BYOK: cifrado autenticado, aislamiento por propietario y no exposicion de la clave.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CredentialService, CredentialNotFoundError, CredentialIntegrityError, CREDENTIAL_ALGORITHM } from '../src/lib/services/credential-service';
import { handleSaveCredential, handleListCredentials, handleChatWithCredential, type CredentialHandlerDeps } from '../src/lib/services/credential-handlers';
import { resolveOwnerFromRequest } from '../src/lib/auth/server-owner';

const MASTER_SECRET = 'test-master-secret-with-enough-length-0123456789';
const OTHER_MASTER_SECRET = 'another-master-secret-with-enough-length-9876543210';

function jsonRequest(url: string, body: unknown, token?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  return new Request(url, { method: 'POST', headers, body: JSON.stringify(body) });
}

function ownerDeps(ownerId: string, dispatch?: CredentialHandlerDeps['dispatch']): CredentialHandlerDeps {
  // Un unico servicio por suite: replica el store compartido de la ruta real.
  const shared = new CredentialService(MASTER_SECRET);
  return {
    resolveOwner: async () => ({ ok: true, ownerId }),
    createService: () => shared,
    fallbackEnabled: true,
    dispatch,
  };
}

describe('BYOK: cifrado AES-256-GCM', () => {
  it('1. cifra y descifra correctamente y guarda iv/authTag/ciphertext/algorithm por separado', () => {
    const service = new CredentialService(MASTER_SECRET);
    const secret = 'sk-test-1234567890';
    const payload = service.encrypt(secret);

    assert.equal(payload.algorithm, CREDENTIAL_ALGORITHM);
    assert.equal(payload.algorithm, 'aes-256-gcm');
    assert.equal(payload.iv.length, 24, 'IV de 12 bytes en hex');
    assert.equal(payload.authTag.length, 32, 'authTag de 16 bytes en hex');
    assert.ok(payload.ciphertext.length > 0);
    assert.ok(!payload.ciphertext.includes(secret), 'el texto cifrado no contiene la clave');

    assert.equal(service.decrypt(payload), secret);

    // IV distinto por cada cifrado
    const second = service.encrypt(secret);
    assert.notEqual(second.iv, payload.iv);
    assert.notEqual(second.ciphertext, payload.ciphertext);
  });

  it('2. rechaza ciphertext o authTag manipulado', () => {
    const service = new CredentialService(MASTER_SECRET);
    const payload = service.encrypt('sk-manipulation-check');

    const badTag = { ...payload, authTag: payload.authTag.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')) };
    assert.throws(() => service.decrypt(badTag), CredentialIntegrityError);

    const flipped = payload.ciphertext[0] === 'a' ? 'b' : 'a';
    const badCiphertext = { ...payload, ciphertext: flipped + payload.ciphertext.slice(1) };
    assert.throws(() => service.decrypt(badCiphertext), CredentialIntegrityError);

    // Otra clave maestra no puede descifrar
    const other = new CredentialService(OTHER_MASTER_SECRET);
    assert.throws(() => other.decrypt(payload), CredentialIntegrityError);

    // Algoritmo distinto se rechaza
    assert.throws(() => service.decrypt({ ...payload, algorithm: 'aes-256-cbc' }), CredentialIntegrityError);
  });
});

describe('BYOK: endpoints y aislamiento por propietario', () => {
  it('3. guarda la credencial y nunca devuelve la clave', async () => {
    const secret = 'sk-never-return-this-value';
    const deps = ownerDeps('user-a');
    const response = await handleSaveCredential(
      jsonRequest('http://local/api/credentials', { providerId: 'gemini', apiKey: secret, model: 'gemini-2.0-flash' }),
      deps,
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.saved, true);
    const serialized = JSON.stringify(response.body);
    assert.ok(!serialized.includes(secret), 'la respuesta no contiene la clave');
    assert.ok(!serialized.toLowerCase().includes('ciphertext'), 'la respuesta no contiene datos cifrados');

    const credential = response.body.credential as Record<string, unknown>;
    assert.ok(typeof credential.credentialId === 'string' && credential.credentialId.length > 0);
    assert.equal(credential.providerId, 'gemini');
    assert.equal(credential.status, 'active');

    // GET solo metadatos del propietario
    const list = await handleListCredentials(new Request('http://local/api/credentials'), deps);
    assert.equal(list.status, 200);
    const credentials = list.body.credentials as Array<Record<string, unknown>>;
    assert.equal(credentials.length, 1);
    assert.ok(!JSON.stringify(credentials).includes(secret), 'los metadatos no contienen la clave');
  });

  it('4. permite acceso solo al propietario (resolucion correcta)', async () => {
    const secret = 'sk-owner-isolation';
    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'groq', apiKey: secret });
    const resolved = await service.resolveForOwner(metadata.credentialId, 'user-a');
    assert.equal(resolved.apiKey, secret);
    assert.equal(resolved.providerId, 'groq');
  });

  it('5. rechaza credentialId de otro usuario con error generico 404', async () => {
    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: 'sk-owned-by-a' });

    await assert.rejects(async () => service.resolveForOwner(metadata.credentialId, 'user-b'), CredentialNotFoundError);

    let dispatchCalled = false;
    const deps = ownerDeps('user-b', async () => { dispatchCalled = true; return { content: 'should not happen' }; });
    const response = await handleChatWithCredential(
      jsonRequest('http://local/api/chat/credentials', { credentialId: metadata.credentialId, messages: [{ role: 'user', content: 'hola' }] }),
      deps,
    );
    assert.equal(response.status, 404);
    assert.equal((response.body.error as Record<string, unknown>).code, 'NOT_FOUND');
    assert.equal(dispatchCalled, false, 'no debe despachar con credencial ajena');
  });

  it('6. rechaza credentialId inexistente con el mismo error generico', async () => {
    const service = new CredentialService(MASTER_SECRET);
    await assert.rejects(async () => service.resolveForOwner('does-not-exist', 'user-a'), CredentialNotFoundError);

    const deps = ownerDeps('user-a');
    const response = await handleChatWithCredential(
      jsonRequest('http://local/api/chat/credentials', {
        credentialId: 'does-not-exist',
        messages: [{ role: 'user', content: 'hola' }],
      }),
      deps,
    );
    assert.equal(response.status, 404);
    assert.equal((response.body.error as Record<string, unknown>).code, 'NOT_FOUND');

    // Peticion mal formada (sin mensajes): la validacion devuelve 400, no filtra existencia.
    const malformed = await handleChatWithCredential(
      jsonRequest('http://local/api/chat/credentials', { credentialId: 'does-not-exist' }),
      deps,
    );
    assert.equal(malformed.status, 400);
    assert.equal((malformed.body.error as Record<string, unknown>).code, 'INVALID_REQUEST');
  });

  it('7. rechaza peticion sin autenticacion y rechaza configuracion de auth ausente', async () => {
    const noAuthDeps: CredentialHandlerDeps = {
      resolveOwner: (request) => resolveOwnerFromRequest(request, { env: {} }),
      createService: () => new CredentialService(MASTER_SECRET),
      fallbackEnabled: true,
    };

    // Sin cabecera Authorization -> 401
    const unauthenticated = await handleSaveCredential(
      jsonRequest('http://local/api/credentials', { providerId: 'gemini', apiKey: 'sk-x' }),
      noAuthDeps,
    );
    assert.equal(unauthenticated.status, 401);
    assert.equal((unauthenticated.body.error as Record<string, unknown>).code, 'UNAUTHORIZED');

    // Con token pero sin configuracion de auth -> CONFIGURATION_ERROR (no se inventa identidad)
    const notConfigured = await handleSaveCredential(
      jsonRequest('http://local/api/credentials', { providerId: 'gemini', apiKey: 'sk-x' }, 'some-token'),
      noAuthDeps,
    );
    assert.equal(notConfigured.status, 500);
    assert.equal((notConfigured.body.error as Record<string, unknown>).code, 'CONFIGURATION_ERROR');
  });

  it('8. rechaza peticion sin CREDENTIAL_MASTER_SECRET', async () => {
    const deps: CredentialHandlerDeps = {
      resolveOwner: async () => ({ ok: true, ownerId: 'user-a' }),
      createService: () => new CredentialService(undefined),
      fallbackEnabled: true,
    };
    const response = await handleSaveCredential(
      jsonRequest('http://local/api/credentials', { providerId: 'gemini', apiKey: 'sk-x' }),
      deps,
    );
    assert.equal(response.status, 500);
    assert.equal((response.body.error as Record<string, unknown>).code, 'CONFIGURATION_ERROR');

    assert.throws(() => new CredentialService(undefined), /CREDENTIAL_MASTER_SECRET/);
  });
});

describe('BYOK: chat usa credentialId y no la clave', () => {
  it('ignora cualquier userId enviado por el navegador', async () => {
    const secret = 'sk-browser-userid-attempt';
    const deps = ownerDeps('server-user-1');
    const response = await handleSaveCredential(
      jsonRequest('http://local/api/credentials', { userId: 'attacker', providerId: 'gemini', apiKey: secret }),
      deps,
    );
    assert.equal(response.status, 201);

    const listRequest = new Request('http://local/api/credentials');
    const asAttacker = await deps.createService(listRequest).listMetadata('attacker');
    const asServerUser = await deps.createService(listRequest).listMetadata('server-user-1');
    assert.equal(asAttacker.length, 0, 'no se guarda bajo identidad del navegador');
    assert.equal(asServerUser.length, 1, 'se guarda bajo la identidad del servidor');
  });

  it('resuelve por credentialId, pasa la clave al proveedor y no la devuelve', async () => {
    const secret = 'sk-dispatch-only';
    const captured: Array<{ providerId: string; model?: string; apiKey: string; messages: Array<{ role: string; content: string }> }> = [];

    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: secret });

    const deps: CredentialHandlerDeps = {
      resolveOwner: async () => ({ ok: true, ownerId: 'user-a' }),
      createService: () => service,
      fallbackEnabled: true,
      dispatch: async (input) => { captured.push(input); return { content: 'respuesta del proveedor' }; },
    };

    const response = await handleChatWithCredential(
      jsonRequest('http://local/api/chat/credentials', {
        credentialId: metadata.credentialId,
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'hola', apiKey: 'sk-injected' }],
      }),
      deps,
    );

    assert.equal(response.status, 200);
    assert.equal(captured.length, 1);
    // La clave usada es la guardada, no la del cliente
    assert.equal(captured[0].apiKey, secret);
    assert.equal(captured[0].providerId, 'gemini');
    assert.equal(captured[0].model, 'gemini-2.0-flash');
    // Los mensajes solo llevan rol y contenido
    assert.deepEqual(captured[0].messages, [{ role: 'user', content: 'hola' }]);
    // La respuesta nunca contiene la clave
    const serialized = JSON.stringify(response.body);
    assert.ok(!serialized.includes(secret), 'la respuesta no contiene la clave guardada');
    assert.ok(!serialized.includes('sk-injected'), 'no se refleja la clave inyectada en el mensaje');
  });

  it('responde error interno acotado si el despachador no esta cableado (via defensiva)', async () => {
    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: 'sk-no-dispatch' });
    const deps = ownerDeps('user-a');
    deps.createService = () => service;

    const response = await handleChatWithCredential(
      jsonRequest('http://local/api/chat/credentials', {
        credentialId: metadata.credentialId,
        messages: [{ role: 'user', content: 'hola' }],
      }),
      deps,
    );
    assert.equal(response.status, 500);
    assert.equal((response.body.error as Record<string, unknown>).code, 'INTERNAL_ERROR');
  });
});
