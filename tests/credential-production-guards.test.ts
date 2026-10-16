// Guardas de produccion: sin Core no hay boveda alternativa silenciosa.
//
// LIMITACION: el puerto del Core es falso; esto verifica logica, no conectividad
// externa con Neon, Supabase ni proveedores.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isCoreMode } from '../src/lib/dante-bridge/bridge-mode';
import { CredentialService } from '../src/lib/services/credential-service';
import {
  handleDeleteCredential,
  handleListCredentials,
  handleSaveCredential,
  handleChatWithCredential,
  type CoreCredentialPort,
  type CredentialHandlerDeps,
} from '../src/lib/services/credential-handlers';

const MASTER_SECRET = 'test-master-secret-with-enough-length-0123456789';
const SECRET = 'sk-production-guard-5c1a';

function jsonRequest(url: string, body?: unknown, method = 'POST'): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Core caido: error de red (no una respuesta HTTP suya). */
const coreDown: CoreCredentialPort = {
  createCredential: async () => { throw new Error('fetch failed'); },
  listCredentials: async () => { throw new Error('fetch failed'); },
  deleteCredential: async () => { throw new Error('fetch failed'); },
  chatWithStoredCredential: async () => { throw new Error('fetch failed'); },
};

function deps(
  local: CredentialService,
  core: CoreCredentialPort | undefined,
  fallbackEnabled: boolean,
): CredentialHandlerDeps {
  return {
    resolveOwner: async () => ({ ok: true, ownerId: 'user-a' }),
    createService: () => local,
    core,
    fallbackEnabled,
  };
}

describe('Guardas de produccion del ciclo BYOK', () => {
  it('el Core es el modo por defecto y el mock exige configuracion explicita', () => {
    assert.equal(isCoreMode({}), true, 'sin DANTE_MODE se usa el Core real');
    assert.equal(isCoreMode({ DANTE_MODE: 'local-core' }), true);
    assert.equal(isCoreMode({ DANTE_MODE: 'mock' }), false);
  });

  it('con el Core caido NO se guarda en la boveda local (sin fallback explicito)', async () => {
    const local = new CredentialService(MASTER_SECRET);
    const d = deps(local, coreDown, false);

    const saved = await handleSaveCredential(
      jsonRequest('http://local/api/credentials', { providerId: 'gemini', apiKey: SECRET }),
      d,
    );
    assert.equal(saved.status, 503);
    assert.equal((saved.body.error as Record<string, unknown>).code, 'UNAVAILABLE');
    assert.equal(JSON.stringify(saved).includes(SECRET), false, 'no se anuncia guardado');
    assert.equal((await local.listMetadata('user-a')).length, 0, 'nada persistido en memoria');

    const listed = await handleListCredentials(jsonRequest('http://local/api/credentials', undefined, 'GET'), d);
    assert.equal(listed.status, 503);

    const removed = await handleDeleteCredential(
      jsonRequest('http://local/api/credentials/x', undefined, 'DELETE'),
      'x',
      d,
    );
    assert.equal(removed.status, 503);

    const chat = await handleChatWithCredential(
      jsonRequest('http://local/api/chat/credentials', {
        credentialId: 'x',
        messages: [{ role: 'user', content: 'hola' }],
      }),
      d,
    );
    assert.equal(chat.status, 503);
  });

  it('el modo temporal solo funciona si se habilita explicitamente (desarrollo)', async () => {
    const local = new CredentialService(MASTER_SECRET);
    const d = deps(local, coreDown, true);

    const saved = await handleSaveCredential(
      jsonRequest('http://local/api/credentials', { providerId: 'gemini', apiKey: SECRET }),
      d,
    );
    assert.equal(saved.status, 201);
    assert.equal(saved.body.storage, 'temporary');
    assert.equal(saved.body.fallback, true);
    assert.equal((await local.listMetadata('user-a')).length, 1);
  });

  it('un proveedor desactivado no puede ejecutarse por BYOK (403 del Core)', async () => {
    const disabledCore: CoreCredentialPort = {
      ...coreDown,
      chatWithStoredCredential: async () => { throw new Error('CORE_HTTP_403'); },
    };
    const local = new CredentialService(MASTER_SECRET);
    const response = await handleChatWithCredential(
      jsonRequest('http://local/api/chat/credentials', {
        credentialId: 'core-cred',
        messages: [{ role: 'user', content: 'hola' }],
      }),
      deps(local, disabledCore, true),
    );

    assert.equal(response.status, 401, 'el Core mapea el bloqueo a credencial rechazada');
    assert.equal(JSON.stringify(response.body).includes(SECRET), false);
  });
});
