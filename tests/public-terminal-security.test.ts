import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  browserAuthStorage,
  getClientSessionMemory,
  clearClientSessionMemory,
  buildBrowserAuthOptions,
  signOut,
} from '../src/lib/auth/client-session';

describe('Seguridad en terminales públicas (R3)', () => {
  beforeEach(() => {
    clearClientSessionMemory();
  });

  it('los tokens de sesión y access_tokens se almacenan estrictamente en memoria volátil', () => {
    const memory = getClientSessionMemory();
    assert.equal(memory.size, 0);

    // Simular escritura de sesión por el SDK de Supabase
    const sessionKey = 'sb-test-auth-token';
    const sessionPayload = JSON.stringify({
      access_token: 'fake-jwt-token-12345',
      refresh_token: 'fake-refresh-token-67890',
      user: { id: '8c66fd54-5080-4201-9c36-a3de4dc45269', email: 'isaac@example.com' },
    });

    browserAuthStorage.setItem(sessionKey, sessionPayload);

    // Debe existir en la memoria volátil
    assert.equal(memory.get(sessionKey), sessionPayload);
    assert.equal(browserAuthStorage.getItem(sessionKey), sessionPayload);
  });

  it('el verifier temporal de PKCE pasa por sessionStorage para sobrevivir a la redirección OAuth', () => {
    const verifierKey = 'sb-test-auth-token-code-verifier';
    const verifierValue = 'random-pkce-verifier-string';

    // En Node no existe window, pero getItem/setItem maneja el caso seguro sin fallar
    browserAuthStorage.setItem(verifierKey, verifierValue);
    // Verifier no ensucia la memoria permanente de la sesión
    const memory = getClientSessionMemory();
    assert.equal(memory.has(verifierKey), false);
  });

  it('clearClientSessionMemory purga completamente los tokens en memoria', () => {
    const sessionKey = 'sb-test-auth-token';
    browserAuthStorage.setItem(sessionKey, 'secret-token-payload');

    const memory = getClientSessionMemory();
    assert.equal(memory.size, 1);

    clearClientSessionMemory();
    assert.equal(memory.size, 0);
    assert.equal(browserAuthStorage.getItem(sessionKey), null);
  });

  it('buildBrowserAuthOptions incluye el adaptador browserAuthStorage con PKCE activo', () => {
    const options = buildBrowserAuthOptions();
    assert.equal(options.auth.storage, browserAuthStorage);
    assert.equal(options.auth.flowType, 'pkce');
    assert.equal(options.auth.persistSession, true);
    assert.equal(options.auth.autoRefreshToken, true);
    assert.equal(options.auth.detectSessionInUrl, false);
  });
});
