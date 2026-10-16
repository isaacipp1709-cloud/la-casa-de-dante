// Store en memoria de La Casa: solo fallback temporal de desarrollo.
//
// LIMITACION EXPLICITA: La Casa ya no mantiene un store durable propio.
// Las credenciales se cifran y persisten en Dante-AI-Core (Neon); aqui solo se
// verifica el fallback temporal y su aislamiento por propietario.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  InMemoryCredentialStore,
  type CredentialRecord,
} from '../src/lib/credentials/credential-store';

const encrypted = {
  algorithm: 'aes-256-gcm',
  iv: 'aabbccddeeff001122334455',
  authTag: '00112233445566778899aabbccddeeff',
  ciphertext: 'deadbeef',
};

async function seed(store: InMemoryCredentialStore, ownerId: string, credentialId: string) {
  await store.create({ ownerId, providerId: 'gemini', credentialId, encrypted, createdAt: 'now' });
}

describe('Fallback en memoria (temporal)', () => {
  it('guarda y recupera por propietario, con iv/authTag/ciphertext/algorithm', async () => {
    const store = new InMemoryCredentialStore();
    await seed(store, 'user-a', 'cred-1');

    const found = await store.findByOwnerAndId('user-a', 'cred-1');
    assert.ok(found);
    assert.deepEqual(found?.encrypted, encrypted);
    assert.equal((await store.listByOwner('user-a')).length, 1);
  });

  it('no encuentra ni elimina credenciales de otro propietario', async () => {
    const store = new InMemoryCredentialStore();
    await seed(store, 'user-a', 'cred-1');

    assert.equal(await store.findByOwnerAndId('user-b', 'cred-1'), null);
    assert.deepEqual(await store.listByOwner('user-b'), []);
    assert.equal(await store.deleteByOwnerAndId('user-b', 'cred-1'), false);
    assert.ok(await store.findByOwnerAndId('user-a', 'cred-1'), 'la credencial sigue existiendo');
  });

  it('elimina solo la credencial propia', async () => {
    const store = new InMemoryCredentialStore();
    await seed(store, 'user-a', 'cred-1');

    assert.equal(await store.deleteByOwnerAndId('user-a', 'cred-1'), true);
    assert.equal(await store.findByOwnerAndId('user-a', 'cred-1'), null);
  });

  it('no expone referencias mutables internas', async () => {
    const store = new InMemoryCredentialStore();
    await seed(store, 'user-a', 'cred-1');

    const first: CredentialRecord | null = await store.findByOwnerAndId('user-a', 'cred-1');
    if (!first) throw new Error('esperado registro');
    first.encrypted.ciphertext = 'manipulado';

    const second = await store.findByOwnerAndId('user-a', 'cred-1');
    assert.equal(second?.encrypted.ciphertext, encrypted.ciphertext);
  });
});
