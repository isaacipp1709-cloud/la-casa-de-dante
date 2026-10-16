// Acceso privado: autenticarse no equivale a estar autorizado.
//
// LIMITACION: el verificador de Supabase es falso (no se contacta Supabase real).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTHORIZED_OWNERS_ENV,
  isAuthorizedOwner,
  readAuthorizedOwners,
} from '../src/lib/auth/authorized-owner';
import { requireAuthorizedOwner } from '../src/lib/auth/require-owner';
import { buildGitHubOAuthOptions } from '../src/lib/auth/github-oauth';

function request(token?: string): Request {
  return new Request('http://local/api/credentials', {
    headers: token ? { authorization: 'Bearer ' + token } : {},
  });
}

/** Supabase Auth falso: verifica tokens 'token-a'/'token-b'. */
const fakeFetch: typeof fetch = async (_input, init) => {
  const auth = String((init?.headers as Record<string, string> | undefined)?.authorization ?? '');
  const token = auth.replace('Bearer ', '');
  const ids: Record<string, string> = { 'token-a': 'user-a', 'token-b': 'user-b' };
  const id = ids[token];
  if (!id) return new Response('{}', { status: 401 });
  return new Response(JSON.stringify({ id }), { status: 200, headers: { 'content-type': 'application/json' } });
};

const baseEnv = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon' };

describe('Autorizacion de usuarios autorizados', () => {
  it('sin lista configurada nadie esta autorizado (deny by default)', () => {
    assert.deepEqual(readAuthorizedOwners({}), []);
    assert.deepEqual(readAuthorizedOwners({ [AUTHORIZED_OWNERS_ENV]: '   ' }), []);
    assert.equal(isAuthorizedOwner('user-a', {}), false);
    assert.equal(isAuthorizedOwner(null, {}), false);
  });

  it('solo entra la identidad listada explicitamente', () => {
    const env = { [AUTHORIZED_OWNERS_ENV]: ' user-a , user-c ' };
    assert.deepEqual(readAuthorizedOwners(env), ['user-a', 'user-c']);
    assert.equal(isAuthorizedOwner('user-a', env), true);
    assert.equal(isAuthorizedOwner('user-c', env), true);
    assert.equal(isAuthorizedOwner('user-b', env), false, 'un usuario valido no basta');
  });

  it('requireAuthorizedOwner exige token, configuracion y autorizacion', async () => {
    const withoutToken = await requireAuthorizedOwner(request(), { env: baseEnv, fetchImpl: fakeFetch });
    assert.equal(withoutToken.ok, false);
    if (!withoutToken.ok) assert.equal(withoutToken.status, 401);

    const withoutConfig = await requireAuthorizedOwner(request('token-a'), { env: {}, fetchImpl: fakeFetch });
    assert.equal(withoutConfig.ok, false);
    if (!withoutConfig.ok) assert.equal(withoutConfig.code, 'CONFIGURATION_ERROR');

    const notListed = await requireAuthorizedOwner(request('token-b'), {
      env: { ...baseEnv, [AUTHORIZED_OWNERS_ENV]: 'user-a' },
      fetchImpl: fakeFetch,
    });
    assert.equal(notListed.ok, false);
    if (!notListed.ok) {
      assert.equal(notListed.status, 403);
      assert.equal(notListed.code, 'USER_NOT_AUTHORIZED');
    }

    const allowed = await requireAuthorizedOwner(request('token-a'), {
      env: { ...baseEnv, [AUTHORIZED_OWNERS_ENV]: 'user-a' },
      fetchImpl: fakeFetch,
    });
    assert.equal(allowed.ok, true);
    if (allowed.ok) assert.equal(allowed.ownerId, 'user-a');
  });

  it('un token invalido no autoriza aunque la lista sea amplia', async () => {
    const result = await requireAuthorizedOwner(request('token-falso'), {
      env: { ...baseEnv, [AUTHORIZED_OWNERS_ENV]: 'user-a,user-b' },
      fetchImpl: fakeFetch,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 401);
  });
});

describe('Acceso con GitHub sin permisos de repositorio', () => {
  it('solicita cero scopes y ningun permiso de repos', () => {
    const options = buildGitHubOAuthOptions('https://casa.example/auth/callback');
    assert.equal(options.provider, 'github');
    assert.equal(options.options.scopes, '', 'sin scopes');
    assert.equal(/repo|read:user|user:email/i.test(JSON.stringify(options)), false);
    assert.equal(options.options.redirectTo, 'https://casa.example/auth/callback');
  });

  it('exige destino explicito y lo propaga', () => {
    const options = buildGitHubOAuthOptions('https://casa.example/auth/callback');
    assert.equal(options.options.scopes, '');
    assert.equal(options.options.redirectTo, 'https://casa.example/auth/callback');
  });
});
