// Store durable (Supabase) con cliente FALSO y fallback en memoria.
//
// LIMITACION EXPLICITA: no se contacta Supabase real, no se ejecuta la migracion
// ni se usan claves reales. El cliente falso emula la cadena PostgREST usada por
// el store (insert / select / delete + eq / maybeSingle).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CredentialService, CredentialNotFoundError } from '../src/lib/services/credential-service';
import {
  CredentialStoreError,
  InMemoryCredentialStore,
  type CredentialRecord,
} from '../src/lib/credentials/credential-store';
import { SupabaseCredentialStore, CREDENTIALS_TABLE } from '../src/lib/credentials/supabase-credential-store';
import {
  getCredentialStorageMode,
  getCredentialStore,
} from '../src/lib/credentials/credential-store-factory';

const MASTER_SECRET = 'test-master-secret-with-enough-length-0123456789';
const SECRET = 'sk-durable-store-value-9a1c7e';

type Row = Record<string, unknown>;
interface QueryResult { data: unknown; error: unknown }

class FakeQuery {
  private action: 'insert' | 'select' | 'delete' = 'select';
  private payload: Row | null = null;
  private readonly filters: Array<{ column: string; value: unknown }> = [];
  private takeSingle = false;

  constructor(private readonly client: FakeSupabaseClient) {}

  insert(payload: Row) { this.action = 'insert'; this.payload = payload; return this; }
  select(_columns?: string) { if (this.action !== 'delete') this.action = 'select'; return this; }
  delete() { this.action = 'delete'; return this; }
  eq(column: string, value: unknown) { this.filters.push({ column, value }); return this; }
  maybeSingle() { this.takeSingle = true; return this; }

  /** Permite `await query` sobre la cadena. */
  then(onFulfilled: (value: QueryResult) => unknown): Promise<unknown> {
    return this.execute().then(onFulfilled);
  }

  private matches(row: Row): boolean {
    return this.filters.every((filter) => row[filter.column] === filter.value);
  }

  private async execute(): Promise<QueryResult> {
    if (this.client.failWith) return { data: null, error: this.client.failWith };

    if (this.action === 'insert') {
      const payload = this.payload ?? {};
      const duplicate = this.client.rows.some((row) => row.credential_id === payload.credential_id);
      if (duplicate) return { data: null, error: { message: 'duplicate key', code: '23505' } };
      this.client.rows.push({ ...payload });
      return { data: null, error: null };
    }

    if (this.action === 'delete') {
      const removed = this.client.rows.filter((row) => this.matches(row));
      this.client.rows = this.client.rows.filter((row) => !this.matches(row));
      return { data: removed.map((row) => ({ credential_id: row.credential_id })), error: null };
    }

    const found = this.client.rows.filter((row) => this.matches(row));
    if (this.takeSingle) return { data: found[0] ?? null, error: null };
    return { data: found, error: null };
  }
}

class FakeSupabaseClient {
  rows: Row[] = [];
  failWith: unknown = null;
  from(table: string) { return new FakeQuery(this); }
}

function fakeClient(): FakeSupabaseClient {
  return new FakeSupabaseClient();
}

function supabaseStore(client: FakeSupabaseClient): SupabaseCredentialStore {
  return new SupabaseCredentialStore(client as unknown as SupabaseClient);
}

const encrypted = {
  algorithm: 'aes-256-gcm',
  iv: 'aabbccddeeff001122334455',
  authTag: '00112233445566778899aabbccddeeff',
  ciphertext: 'deadbeef',
};

describe('Store durable (Supabase) con cliente falso', () => {
  it('1. crea la credencial y la recupera por propietario', async () => {
    const client = fakeClient();
    const store = supabaseStore(client);

    await store.create({
      ownerId: 'user-a',
      providerId: 'gemini',
      credentialId: 'cred-1',
      encrypted,
      createdAt: '2026-10-16T00:00:00.000Z',
    });

    const found = await store.findByOwnerAndId('user-a', 'cred-1');
    assert.ok(found, 'la credencial se recupera');
    assert.equal(found?.credentialId, 'cred-1');
    assert.equal(found?.ownerId, 'user-a');
    assert.equal(found?.providerId, 'gemini');
    assert.equal(found?.createdAt, '2026-10-16T00:00:00.000Z');

    const listed = await store.listByOwner('user-a');
    assert.equal(listed.length, 1);
    assert.equal(listed[0].credentialId, 'cred-1');
  });

  it('2. no encuentra la credencial de otro propietario', async () => {
    const client = fakeClient();
    const store = supabaseStore(client);
    await store.create({ ownerId: 'user-a', providerId: 'gemini', credentialId: 'cred-1', encrypted, createdAt: 'now' });

    assert.equal(await store.findByOwnerAndId('user-b', 'cred-1'), null);
    assert.deepEqual(await store.listByOwner('user-b'), []);
  });

  it('3. elimina solo la credencial propia', async () => {
    const client = fakeClient();
    const store = supabaseStore(client);
    await store.create({ ownerId: 'user-a', providerId: 'gemini', credentialId: 'cred-1', encrypted, createdAt: 'now' });

    assert.equal(await store.deleteByOwnerAndId('user-a', 'cred-1'), true);
    assert.equal(await store.findByOwnerAndId('user-a', 'cred-1'), null);
    assert.equal(client.rows.length, 0, 'la fila se elimino');
  });

  it('4. no elimina la credencial ajena', async () => {
    const client = fakeClient();
    const store = supabaseStore(client);
    await store.create({ ownerId: 'user-a', providerId: 'gemini', credentialId: 'cred-1', encrypted, createdAt: 'now' });

    assert.equal(await store.deleteByOwnerAndId('user-b', 'cred-1'), false);
    assert.equal(client.rows.length, 1, 'la fila sigue existiendo');
    assert.ok(await store.findByOwnerAndId('user-a', 'cred-1'), 'el propietario la conserva');
  });

  it('5. persiste iv, authTag, ciphertext y algorithm por separado y sin la clave', async () => {
    const client = fakeClient();
    const store = supabaseStore(client);
    await store.create({
      ownerId: 'user-a',
      providerId: 'gemini',
      credentialId: 'cred-1',
      encrypted,
      createdAt: '2026-10-16T00:00:00.000Z',
    });

    const row = client.rows[0];
    assert.equal(row.algorithm, 'aes-256-gcm');
    assert.equal(row.iv, encrypted.iv);
    assert.equal(row.auth_tag, encrypted.authTag);
    assert.equal(row.ciphertext, encrypted.ciphertext);
    assert.equal(row.owner_id, 'user-a');
    assert.equal(row.provider_id, 'gemini');
    assert.equal(row.credential_id, 'cred-1');
    assert.equal(
      Object.values(row).some((value) => typeof value === 'string' && value.includes(SECRET)),
      false,
      'ninguna columna contiene la API key en claro',
    );

    const stored = await store.findByOwnerAndId('user-a', 'cred-1');
    assert.deepEqual(stored?.encrypted, encrypted);
  });

  it('convierte errores del proveedor de datos en error generico', async () => {
    const client = fakeClient();
    client.failWith = { message: 'connection to 10.0.0.5 refused', code: 'ECONNREFUSED' };
    const store = supabaseStore(client);

    await assert.rejects(
      async () => store.listByOwner('user-a'),
      (error: unknown) => {
        assert.ok(error instanceof CredentialStoreError);
        assert.equal(String((error as Error).message).includes('10.0.0.5'), false, 'sin detalles internos');
        return true;
      },
    );
  });
});

describe('Integracion servicio + store durable', () => {
  it('guarda cifrado, resuelve por propietario y elimina con aislamiento', async () => {
    const client = fakeClient();
    const service = new CredentialService(MASTER_SECRET, supabaseStore(client));

    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });
    assert.equal(metadata.providerId, 'gemini');

    // La clave no esta en claro en la fila persistida
    assert.equal(JSON.stringify(client.rows).includes(SECRET), false);

    const resolved = await service.resolveForOwner(metadata.credentialId, 'user-a');
    assert.equal(resolved.apiKey, SECRET, 'se descifra solo para el propietario');
    assert.equal(resolved.providerId, 'gemini');

    await assert.rejects(
      async () => service.resolveForOwner(metadata.credentialId, 'user-b'),
      CredentialNotFoundError,
    );
    await assert.rejects(
      async () => service.deleteForOwner(metadata.credentialId, 'user-b'),
      CredentialNotFoundError,
    );
    assert.equal((await service.listMetadata('user-a')).length, 1, 'el borrado ajeno no afecta');

    await service.deleteForOwner(metadata.credentialId, 'user-a');
    assert.equal((await service.listMetadata('user-a')).length, 0);
  });
});

describe('Seleccion del store (factory)', () => {
  it('6. usa Supabase cuando hay configuracion y memoria cuando no', () => {
    const durable = getCredentialStore({
      env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon-key' },
    });
    assert.ok(durable instanceof SupabaseCredentialStore);

    const memory = getCredentialStore({ env: {} });
    assert.ok(memory instanceof InMemoryCredentialStore);

    assert.equal(
      getCredentialStorageMode({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon-key' }),
      'durable',
    );
    assert.equal(getCredentialStorageMode({}), 'memory');
  });

  it('el fallback en memoria se comparte entre solicitudes (comportamiento actual preservado)', async () => {
    const first = getCredentialStore({ env: {} });
    const second = getCredentialStore({ env: {} });
    assert.equal(first, second, 'misma instancia de proceso');

    const service = new CredentialService(MASTER_SECRET, first);
    const metadata = await service.save({ ownerId: 'user-a', providerId: 'gemini', apiKey: SECRET });

    const otherService = new CredentialService(MASTER_SECRET, second);
    assert.equal((await otherService.listMetadata('user-a')).length, 1);
    assert.equal((await otherService.resolveForOwner(metadata.credentialId, 'user-a')).apiKey, SECRET);
  });
});

describe('Store en memoria', () => {
  it('aplica el mismo aislamiento por propietario', async () => {
    const store = new InMemoryCredentialStore();
    await store.create({ ownerId: 'user-a', providerId: 'gemini', credentialId: 'cred-1', encrypted, createdAt: 'now' });

    assert.equal(await store.deleteByOwnerAndId('user-b', 'cred-1'), false);
    assert.ok(await store.findByOwnerAndId('user-a', 'cred-1'));
    assert.equal(await store.deleteByOwnerAndId('user-a', 'cred-1'), true);
    assert.equal(await store.findByOwnerAndId('user-a', 'cred-1'), null);
  });

  it('no expone referencias mutables internas', async () => {
    const store = new InMemoryCredentialStore();
    await store.create({ ownerId: 'user-a', providerId: 'gemini', credentialId: 'cred-1', encrypted, createdAt: 'now' });

    const first = await store.findByOwnerAndId('user-a', 'cred-1');
    if (!first) throw new Error('esperado registro');
    first.encrypted.ciphertext = 'manipulado';

    const second = await store.findByOwnerAndId('user-a', 'cred-1');
    assert.equal(second?.encrypted.ciphertext, encrypted.ciphertext, 'el store devuelve copias');
  });
});
