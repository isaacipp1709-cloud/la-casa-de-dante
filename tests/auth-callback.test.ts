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
  executeSignInWithGuards,
  LOGIN_TIMEOUT_MESSAGE,
  LOGIN_TIMEOUT_MS,
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

describe('Guarda contra bloqueo de redirección en Login (R2)', () => {
  it('resetea busy a false inmediatamente en finally ante fallo devuelto por signIn', async () => {
    const states: Array<{ busy: boolean; message: string | null }> = [];
    const mockSignIn = async () => ({ ok: false, message: 'Falta configuración de Supabase' });

    const result = await executeSignInWithGuards(mockSignIn, {
      onStateChange: (s) => states.push(s),
    });

    assert.equal(result.ok, false);
    assert.equal(result.message, 'Falta configuración de Supabase');
    assert.deepEqual(states, [
      { busy: true, message: null },
      { busy: false, message: 'Falta configuración de Supabase' },
    ]);
  });

  it('resetea busy a false en finally ante excepción no controlada o fallo de red', async () => {
    const states: Array<{ busy: boolean; message: string | null }> = [];
    const mockSignIn = async () => {
      throw new Error('Network error: Failed to fetch');
    };

    const result = await executeSignInWithGuards(mockSignIn, {
      onStateChange: (s) => states.push(s),
    });

    assert.equal(result.ok, false);
    assert.match(String(result.message), /Network error/i);
    assert.equal(states[0].busy, true);
    assert.equal(states[states.length - 1].busy, false, 'busy debe restaurarse a false');
    assert.match(String(states[states.length - 1].message), /Network error/i);
  });

  it('el temporizador de seguridad desbloquea el botón si la redirección demora más de 15s', async () => {
    const states: Array<{ busy: boolean; message: string | null }> = [];
    let scheduledCallback: (() => void) | null = null;
    let registeredMs = 0;

    const mockTimer = {
      setTimeout: (fn: () => void, ms: number) => {
        scheduledCallback = fn;
        registeredMs = ms;
        return 999;
      },
      clearTimeout: () => {
        scheduledCallback = null;
      },
    };

    // Simula éxito inicial donde el navegador debería navegar pero queda colgado
    const mockSignIn = async () => ({ ok: true });

    const result = await executeSignInWithGuards(mockSignIn, {
      onStateChange: (s) => states.push(s),
      timerApi: mockTimer,
    });

    assert.equal(result.ok, true);
    assert.equal(registeredMs, LOGIN_TIMEOUT_MS);
    assert.equal(states.length, 1);
    assert.equal(states[0].busy, true, 'inicialmente en estado Redirigiendo...');

    // Se dispara el temporizador al cumplirse el timeout
    assert.ok(typeof scheduledCallback === 'function');
    (scheduledCallback as () => void)();

    assert.equal(states.length, 2);
    assert.equal(states[1].busy, false, 'el timeout restaura busy a false');
    assert.equal(states[1].message, LOGIN_TIMEOUT_MESSAGE);
  });

  it('un error en signIn cancela el temporizador para que no se dispare después', async () => {
    let timerCleared = false;
    let timerIdSet: unknown = null;

    const mockTimer = {
      setTimeout: () => {
        timerIdSet = 123;
        return timerIdSet;
      },
      clearTimeout: (id: unknown) => {
        if (id === timerIdSet) timerCleared = true;
      },
    };

    await executeSignInWithGuards(
      async () => ({ ok: false, message: 'Rechazado' }),
      {
        onStateChange: () => {},
        timerApi: mockTimer,
      }
    );

    assert.equal(timerCleared, true, 'el timer debe ser cancelado si hay error');
  });
});

