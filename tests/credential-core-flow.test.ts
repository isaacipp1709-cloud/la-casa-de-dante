// Flujo BYOK respaldado por Dante-AI-Core: La Casa no cifra ni persiste claves.
//
// LIMITACION EXPLICITA: el puerto del Core es falso (no se contacta el Core, Neon
// ni proveedores reales). El store en memoria se usa solo como fallback temporal.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CredentialService } from '../src/lib/services/credential-service';
import {
  handleDeleteCredential,
  handleListCredentials,
  handleSaveCredential,
  handleChatWithCredential,
  handleChatWithStoredCredentialFromBody,
  type CoreCredentialPort,
  type CredentialHandlerDeps,
} from '../src/lib/services/credential-handlers';
import { signOwnerAssertion, OWNER_ASSERTION_HEADER } from '../src/lib/credentials/owner-assertion';
import { composeConnectionsPanel } from '../src/lib/connections/connection-panel';

const MASTER_SECRET = 'test-master-secret-with-enough-length-0123456789';
const SECRET = 'sk-casa-core-flow-4b7e21';

interface CoreCall {
  operation: string;
  ownerId: string;
  providerId?: string;
  credentialId?: string;
  apiKey?: string;
  model?: string;
}

function fakeCore(options: { fail?: Error; credentialId?: string } = {}) {
  const calls: CoreCall[] = [];
  const credentialId = options.credentialId ?? 'core-cred-1';

  const port: CoreCredentialPort = {
    async createCredential(input) {
      calls.push({ operation: 'create', ownerId: input.ownerId, providerId: input.providerId, apiKey: input.apiKey });
      if (options.fail) throw options.fail;
      return {
        storage: 'durable',
        credential: { credentialId, providerId: input.providerId, createdAt: '2026-10-16T00:00:00.000Z', status: 'active' },
      };
    },
    async listCredentials(ownerId) {
      calls.push({ operation: 'list', ownerId });
      if (options.fail) throw options.fail;
      return {
        storage: 'durable',
        credentials: [{ credentialId, providerId: 'gemini', createdAt: '2026-10-16T00:00:00.000Z', status: 'active' }],
      };
    },
    async deleteCredential(ownerId, id) {
      calls.push({ operation: 'delete', ownerId, credentialId: id });
      if (options.fail) throw options.fail;
      return { storage: 'durable', credentialId: id };
    },
    async chatWithStoredCredential(input) {
      calls.push({ operation: 'chat', ownerId: input.ownerId, credentialId: input.credentialId, model: input.model });
      if (options.fail) throw options.fail;
      return {
        message: { role: 'assistant', content: 'respuesta del Core' },
        status: 'success',
        correlationId: 'corr-1',
        providerId: 'gemini',
        model: 'gemini-1.5-flash',
      };
    },
  };

  return { port, calls };
}

function jsonRequest(url: string, body?: unknown, method = 'POST'): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function deps(ownerId: string, core: CoreCredentialPort | undefined, service?: CredentialService): CredentialHandlerDeps {
  const local = service ?? new CredentialService(MASTER_SECRET);
  return { resolveOwner: async () => ({ ok: true, ownerId }), createService: () => local, core };
}

describe('Ciclo BYOK a traves de Dante-AI-Core', () => {
  it('1. crear credencial en el Core sin devolver la clave', async () => {
    const { port, calls } = fakeCore();
    const local = new CredentialService(MASTER_SECRET);
    const response = await handleSaveCredential(
      jsonRequest('http://local/api/credentials', { providerId: 'gemini', apiKey: SECRET }),
      deps('user-a', port, local),
    );

    assert.equal(response.status, 201);
    assert.equal(response.body.saved, true);
    assert.equal(response.body.storage, 'durable');
    assert.equal(JSON.stringify(response.body).includes(SECRET), false, 'la respuesta no contiene la clave');

    // La clave viaja al Core (server-side) y no queda en La Casa
    assert.deepEqual(calls, [{ operation: 'create', ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET }]);
    assert.equal((await local.listMetadata('user-a')).length, 0, 'La Casa no persiste la credencial');
  });

  it('2. listar solo credenciales propias (el Core recibe el ownerId autenticado)', async () => {
    const { port, calls } = fakeCore();
    const response = await handleListCredentials(
      jsonRequest('http://local/api/credentials', undefined, 'GET'),
      deps('user-a', port),
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.storage, 'durable');
    assert.equal((response.body.credentials as unknown[]).length, 1);
    assert.deepEqual(calls, [{ operation: 'list', ownerId: 'user-a' }]);
  });

  it('3. rechaza la credencial ajena con el error generico del Core', async () => {
    const { port } = fakeCore({ fail: new Error('CORE_HTTP_404') });
    const response = await handleChatWithCredential(
      jsonRequest('http://local/api/chat/credentials', {
        credentialId: 'ajena',
        messages: [{ role: 'user', content: 'hola' }],
      }),
      deps('user-b', port),
    );

    assert.equal(response.status, 404);
    assert.equal((response.body.error as Record<string, unknown>).code, 'NOT_FOUND');
  });

  it('4. elimina solo la credencial propia', async () => {
    const { port, calls } = fakeCore();
    const response = await handleDeleteCredential(
      jsonRequest('http://local/api/credentials/core-cred-1', undefined, 'DELETE'),
      'core-cred-1',
      deps('user-a', port),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { deleted: true, credentialId: 'core-cred-1', storage: 'durable' });
    assert.deepEqual(calls, [{ operation: 'delete', ownerId: 'user-a', credentialId: 'core-cred-1' }]);
  });

  it('5. resuelve la credencial en el Core para ejecutar el chat', async () => {
    const { port, calls } = fakeCore();
    const depsA = deps('user-a', port);

    const simple = await handleChatWithCredential(
      jsonRequest('http://local/api/chat/credentials', {
        credentialId: 'core-cred-1',
        messages: [{ role: 'user', content: 'hola' }],
      }),
      depsA,
    );
    assert.equal(simple.status, 200);
    assert.equal(simple.body.content, 'respuesta del Core');
    assert.equal(simple.body.resolvedBy, 'core');

    const full = await handleChatWithStoredCredentialFromBody(
      jsonRequest('http://local/api/chat'),
      { credentialId: 'core-cred-1', messages: [{ role: 'user', content: 'hola' }], model: 'gemini-2.0-flash' },
      depsA,
    );
    assert.equal(full.status, 200);
    assert.equal(full.body.providerId, 'gemini');
    assert.equal(full.body.model, 'gemini-1.5-flash');
    assert.equal(JSON.stringify(full.body).includes(SECRET), false);

    assert.deepEqual(
      calls.filter((c) => c.operation === 'chat').map((c) => [c.ownerId, c.credentialId]),
      [['user-a', 'core-cred-1'], ['user-a', 'core-cred-1']],
    );
  });

  it('6. rechaza una API key enviada por el cliente en operaciones que no corresponde', async () => {
    const { port } = fakeCore();

    const chatWithKey = await handleChatWithStoredCredentialFromBody(
      jsonRequest('http://local/api/chat'),
      { messages: [{ role: 'user', content: 'hola' }], apiKey: SECRET },
      deps('user-a', port),
    );
    assert.equal(chatWithKey.status, 400);

    const listWithKey = await handleListCredentials(
      jsonRequest('http://local/api/credentials?apiKey=sk-leak', undefined, 'GET'),
      deps('user-a', port),
    );
    assert.equal(listWithKey.status, 400);
    assert.equal((listWithKey.body.error as Record<string, unknown>).code, 'INVALID_REQUEST');
  });

  it('7. La Casa no persiste credenciales localmente', async () => {
    const { port } = fakeCore();
    const local = new CredentialService(MASTER_SECRET);
    const depsA = deps('user-a', port, local);

    await handleSaveCredential(
      jsonRequest('http://local/api/credentials', { providerId: 'gemini', apiKey: SECRET }),
      depsA,
    );

    // El store propio de La Casa permanece vacio: todo vive en el Core
    assert.equal((await local.listMetadata('user-a')).length, 0);
    assert.equal((await local.listMetadata('user-b')).length, 0);

    // Y el fallback local solo se activa si el Core no responde
    await handleSaveCredential(
      jsonRequest('http://local/api/credentials', { providerId: 'gemini', apiKey: 'sk-fallback' }),
      deps('user-a', fakeCore({ fail: new Error('fetch failed') }).port, local),
    );
    assert.equal((await local.listMetadata('user-a')).length, 1, 'solo el fallback usa memoria');
  });

  it('8. el fallback temporal funciona si el Core no esta disponible', async () => {
    const unavailable = fakeCore({ fail: new Error('TIMEOUT') }).port;
    const local = new CredentialService(MASTER_SECRET);
    const depsA = deps('user-a', unavailable, local);

    const saved = await handleSaveCredential(
      jsonRequest('http://local/api/credentials', { providerId: 'gemini', apiKey: SECRET }),
      depsA,
    );
    assert.equal(saved.status, 201);
    assert.equal(saved.body.storage, 'temporary');
    assert.equal(saved.body.fallback, true);
    assert.equal(JSON.stringify(saved.body).includes(SECRET), false);

    const listed = await handleListCredentials(
      jsonRequest('http://local/api/credentials', undefined, 'GET'),
      depsA,
    );
    assert.equal(listed.status, 200);
    assert.equal(listed.body.storage, 'temporary');
    assert.equal(listed.body.fallback, true);

    const credentialId = (saved.body.credential as { credentialId: string }).credentialId;
    const removed = await handleDeleteCredential(
      jsonRequest('http://local/api/credentials/' + credentialId, undefined, 'DELETE'),
      credentialId,
      depsA,
    );
    assert.equal(removed.status, 200);
    assert.equal(removed.body.storage, 'temporary');
  });
});

describe('Identidad firmada de La Casa para el Core', () => {
  it('firma una asercion con HMAC y no la emite sin secreto', () => {
    const assertion = signOwnerAssertion('user-a', { secret: 'secreto-de-prueba-suficientemente-largo', ttlMs: 1000 });
    assert.ok(assertion);
    const [payload, signature] = String(assertion).split('.');
    assert.ok(payload.length > 0 && signature.length > 0);
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { ownerId: string; exp: number };
    assert.equal(decoded.ownerId, 'user-a');
    assert.ok(decoded.exp > Date.now());

    assert.equal(signOwnerAssertion('user-a', { secret: '' }), null);
    assert.equal(signOwnerAssertion('', { secret: 'x' }), null);
  });

  it('el nombre de la cabecera es estable para el Core', () => {
    assert.equal(OWNER_ASSERTION_HEADER, 'x-dante-owner-assertion');
  });
});

describe('Panel: estado real de credenciales BYOK', () => {
  it('refleja persistencia durable o temporal sin exponer detalles', () => {
    const durable = composeConnectionsPanel({
      core: { generatedAt: 'now', storage: 'durable', connections: [] },
      bridgeReachable: true,
      authConfigured: true,
      byokCounts: { gemini: 1 },
    });
    const byok = durable.connections.find((c) => c.id === 'credentials.byok');
    assert.equal(byok?.status, 'active');
    assert.equal(byok?.byokAvailable, true);
    assert.match(String(byok?.detail), /durable/i);

    const temporary = composeConnectionsPanel({
      core: { generatedAt: 'now', storage: 'temporary', connections: [] },
      bridgeReachable: true,
      authConfigured: true,
    });
    const tempRow = temporary.connections.find((c) => c.id === 'credentials.byok');
    assert.equal(tempRow?.status, 'incomplete');
    assert.match(String(tempRow?.detail), /temporal/i);

    const serialized = JSON.stringify(durable);
    assert.equal(/postgres:\/\/|apiKey|sk-/.test(serialized), false, 'sin secretos ni URLs');
  });
});
