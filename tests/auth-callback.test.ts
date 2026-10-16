// Retorno OAuth determinista: destino fijo, PKCE explicito y un solo intercambio.
//
// LIMITACION: no hay navegador ni Supabase real; se verifican las decisiones
// puras del flujo (destino, opciones, parametros, guarda de unica ejecucion).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  OAUTH_CALLBACK_PATH,
  buildCallbackRedirect,
  buildGitHubOAuthOptions,
} from '../src/lib/auth/github-oauth';
import {
  buildBrowserAuthOptions,
  createSingleFlight,
  describeCallbackFailure,
  readOAuthCallbackParams,
} from '../src/lib/auth/client-session';

describe('Destino de retorno fijo', () => {
  it('construye exactamente /auth/callback desde el origin', () => {
    assert.equal(buildCallbackRedirect('https://casa.example'), 'https://casa.example' + OAUTH_CALLBACK_PATH);
    assert.equal(OAUTH_CALLBACK_PATH, '/auth/callback');
  });

  it('no acepta destinos arbitrarios: descarta path y query del origen', () => {
    assert.equal(buildCallbackRedirect('https://casa.example/evil?next=https://attacker'), 'https://casa.example/auth/callback');
    assert.equal(buildCallbackRedirect('https://casa.example/'), 'https://casa.example/auth/callback');
    assert.equal(buildCallbackRedirect('http://localhost:3000'), 'http://localhost:3000/auth/callback');
  });

  it('las opciones de GitHub llevan el destino fijo y cero scopes', () => {
    const options = buildGitHubOAuthOptions('https://casa.example/auth/callback');
    assert.equal(options.provider, 'github');
    assert.equal(options.options.scopes, '');
    assert.equal(options.options.redirectTo, 'https://casa.example/auth/callback');
    assert.equal(/repo|read:user|user:email/i.test(JSON.stringify(options)), false);
  });
});

describe('PKCE explicito y un solo intercambio', () => {
  it('el cliente declara flowType pkce y desactiva el intercambio automatico', () => {
    const options = buildBrowserAuthOptions();
    assert.equal(options.auth.flowType, 'pkce');
    assert.equal(options.auth.detectSessionInUrl, false, 'un unico mecanismo: el manual');
    assert.equal(options.auth.persistSession, true);
    assert.equal(options.auth.autoRefreshToken, true);
  });

  it('la guarda impide un segundo intercambio (StrictMode/recarga)', () => {
    const once = createSingleFlight();
    assert.equal(once(), true);
    assert.equal(once(), false);
    assert.equal(once(), false);
  });

  it('lee parametros sin exponer la URL completa', () => {
    assert.deepEqual(readOAuthCallbackParams('?code=abc123&state=s'), {
      code: 'abc123',
      error: null,
      errorDescription: null,
    });
    const error = readOAuthCallbackParams('?error=access_denied&error_description=User%20denied');
    assert.equal(error.error, 'access_denied');
    assert.equal(error.code, null);
  });

  it('describe el fallo y no produce redirecciones', () => {
    assert.equal(describeCallbackFailure({ code: 'abc', error: null, errorDescription: null }), null);
    assert.match(String(describeCallbackFailure({ code: null, error: null, errorDescription: null })), /codigo/i);
    assert.match(
      String(describeCallbackFailure({ code: null, error: 'access_denied', errorDescription: 'x' })),
      /rechazo|cancelo/i,
    );
  });
});
