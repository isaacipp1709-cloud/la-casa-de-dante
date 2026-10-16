// Gestion de credenciales: crear, listar y eliminar con aislamiento por propietario.
//
// LIMITACION EXPLICITA: no hay llamadas externas ni claves reales; se usa el store
// en memoria del servicio (sin base de datos remota).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CredentialService, PROVIDER_ALLOWLIST } from '../src/lib/services/credential-service';
import {
  handleDeleteCredential,
  handleListCredentials,
  handleSaveCredential,
  rejectClientKeyInRequest,
  type CredentialHandlerDeps,
} from '../src/lib/services/credential-handlers';
import { resolveOwnerFromRequest } from '../src/lib/auth/server-owner';
import { BYOK_PROVIDER_IDS, BYOK_PROVIDERS, isAllowedProviderId } from '../src/lib/credentials/provider-catalog';

const MASTER_SECRET = 'test-master-secret-with-enough-length-0123456789';
const SECRET = 'sk-managed-credential-4c8b1f';

function request(url: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function depsFor(ownerId: string, service: CredentialService): CredentialHandlerDeps {
  return { resolveOwner: async () => ({ ok: true, ownerId }), createService: () => service, fallbackEnabled: true };
}

describe('Gestion de credenciales desde la UI', () => {
  it('1. crear credencial devuelve solo metadatos y nunca la clave', async () => {
    const service = new CredentialService(MASTER_SECRET);
    const response = await handleSaveCredential(
      request('http://local/api/credentials', 'POST', { providerId: 'gemini', apiKey: SECRET }),
      depsFor('user-a', service),
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.saved, true);
    const serialized = JSON.stringify(response.body);
    assert.ok(!serialized.includes(SECRET), 'la respuesta no contiene la clave');
    assert.ok(!serialized.toLowerCase().includes('ciphertext'));

    const credential = response.body.credential as Record<string, unknown>;
    assert.ok(typeof credential.credentialId === 'string');
    assert.equal(credential.providerId, 'gemini');
    assert.ok(typeof credential.createdAt === 'string');
    assert.equal(credential.status, 'active');
  });

  it('2. el listado muestra solo las credenciales del propietario autenticado', async () => {
    const service = new CredentialService(MASTER_SECRET);
    await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });
    await service.save({ ownerId: 'user-a', providerId: 'groq', apiKey: 'sk-other' });
    await service.save({ ownerId: 'user-b', providerId: 'gemini', apiKey: 'sk-ajena' });

    const own = await handleListCredentials(request('http://local/api/credentials'), depsFor('user-a', service));
    assert.equal(own.status, 200);
    const list = own.body.credentials as Array<Record<string, unknown>>;
    assert.equal(list.length, 2);
    assert.deepEqual(Array.from(new Set(list.map((c) => c.providerId))).sort(), ['gemini', 'groq']);
    assert.ok(!JSON.stringify(own.body).includes(SECRET));

    const other = await handleListCredentials(request('http://local/api/credentials'), depsFor('user-b', service));
    assert.equal((other.body.credentials as unknown[]).length, 1);

    const empty = await handleListCredentials(request('http://local/api/credentials'), depsFor('user-c', service));
    assert.equal((empty.body.credentials as unknown[]).length, 0);
  });

  it('3. elimina una credencial propia y borra sus datos cifrados', async () => {
    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });

    const response = await handleDeleteCredential(
      request(`http://local/api/credentials/${metadata.credentialId}`, 'DELETE'),
      metadata.credentialId,
      depsFor('user-a', service),
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.deleted, true);
    assert.equal(response.body.credentialId, metadata.credentialId);
    assert.ok(!JSON.stringify(response.body).includes(SECRET), 'no se devuelve la clave');

    // Ya no existe ni se puede resolver
    await assert.rejects(async () => service.resolveForOwner(metadata.credentialId, 'user-a'));
    const after = await handleListCredentials(request('http://local/api/credentials'), depsFor('user-a', service));
    assert.equal((after.body.credentials as unknown[]).length, 0);
  });

  it('4. rechaza el borrado de una credencial ajena con el mismo error generico', async () => {
    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });

    const response = await handleDeleteCredential(
      request(`http://local/api/credentials/${metadata.credentialId}`, 'DELETE'),
      metadata.credentialId,
      depsFor('user-b', service),
    );

    assert.equal(response.status, 404);
    assert.equal((response.body.error as Record<string, unknown>).code, 'NOT_FOUND');

    // Sigue existiendo para su propietario
    const stillThere = await handleListCredentials(request('http://local/api/credentials'), depsFor('user-a', service));
    assert.equal((stillThere.body.credentials as unknown[]).length, 1);
    assert.equal((await service.resolveForOwner(metadata.credentialId, 'user-a')).apiKey, SECRET);

    // Inexistente -> mismo error generico
    const missing = await handleDeleteCredential(
      request('http://local/api/credentials/no-existe', 'DELETE'),
      'no-existe',
      depsFor('user-a', service),
    );
    assert.equal(missing.status, 404);
    assert.equal((missing.body.error as Record<string, unknown>).code, 'NOT_FOUND');
  });

  it('5. rechaza el borrado sin autenticacion del servidor', async () => {
    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });

    const deps: CredentialHandlerDeps = {
      resolveOwner: (req) => resolveOwnerFromRequest(req, { env: {} }),
      createService: () => service,
      fallbackEnabled: true,
    };

    const noAuth = await handleDeleteCredential(
      request(`http://local/api/credentials/${metadata.credentialId}`, 'DELETE'),
      metadata.credentialId,
      deps,
    );
    assert.equal(noAuth.status, 401);
    assert.equal((noAuth.body.error as Record<string, unknown>).code, 'UNAUTHORIZED');

    const listNoAuth = await handleListCredentials(request('http://local/api/credentials'), deps);
    assert.equal(listNoAuth.status, 401);

    // La credencial no se toco
    assert.equal((await service.resolveForOwner(metadata.credentialId, 'user-a')).apiKey, SECRET);
  });

  it('6. rechaza una clave enviada en operaciones donde no corresponde', async () => {
    const service = new CredentialService(MASTER_SECRET);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });
    const deps = depsFor('user-a', service);

    const listWithQueryKey = await handleListCredentials(
      request('http://local/api/credentials?apiKey=sk-leak'),
      deps,
    );
    assert.equal(listWithQueryKey.status, 400);
    assert.equal((listWithQueryKey.body.error as Record<string, unknown>).code, 'INVALID_REQUEST');

    const listWithHeaderKey = await handleListCredentials(
      request('http://local/api/credentials', 'GET', undefined, { 'x-api-key': 'sk-leak' }),
      deps,
    );
    assert.equal(listWithHeaderKey.status, 400);

    const deleteWithQueryKey = await handleDeleteCredential(
      request(`http://local/api/credentials/${metadata.credentialId}?api_key=sk-leak`, 'DELETE'),
      metadata.credentialId,
      deps,
    );
    assert.equal(deleteWithQueryKey.status, 400);

    // Sin clave: las operaciones normales siguen funcionando
    assert.equal(rejectClientKeyInRequest(request('http://local/api/credentials')), null);
    const okList = await handleListCredentials(request('http://local/api/credentials'), deps);
    assert.equal(okList.status, 200);
    assert.equal((okList.body.credentials as unknown[]).length, 1);
  });

  it('el catalogo de proveedores es unico y coincide con el del servicio', () => {
    assert.deepEqual([...PROVIDER_ALLOWLIST], [...BYOK_PROVIDER_IDS]);
    assert.ok(isAllowedProviderId('gemini'));
    assert.ok(!isAllowedProviderId('proveedor-inexistente'));
    assert.ok(!isAllowedProviderId('groq-llama3'), 'los ids del catalogo de bridge no son validos para credenciales');
    const gemini = BYOK_PROVIDERS.find((p) => p.id === 'gemini');
    assert.equal(gemini?.adapterReady, true);
    assert.equal(BYOK_PROVIDERS.filter((p) => p.adapterReady).length, 1, 'solo gemini tiene adaptador real');
  });
});
