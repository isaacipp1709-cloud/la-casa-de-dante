/**
 * Opciones del acceso "Continuar con GitHub" via Supabase Auth.
 *
 * - CERO scopes: el inicio de sesion no pide permisos sobre repositorios.
 * - El destino de retorno es SIEMPRE la ruta interna fija /auth/callback,
 *   construida desde el origin real del navegador. No se acepta un destino
 *   arbitrario enviado por el usuario.
 */

export const OAUTH_CALLBACK_PATH = '/auth/callback';

export interface GitHubOAuthOptions {
  provider: 'github';
  options: {
    scopes: string;
    redirectTo: string;
    queryParams?: Record<string, string>;
  };
}

/** Destino de retorno fijo: se descarta cualquier path del origin recibido. */
export function buildCallbackRedirect(origin: string): string {
  const base = new URL(origin).origin;
  return base + OAUTH_CALLBACK_PATH;
}

export function buildGitHubOAuthOptions(redirectTo: string): GitHubOAuthOptions {
  return {
    provider: 'github',
    options: {
      scopes: '',
      redirectTo,
      queryParams: { prompt: 'select_account' },
    },
  };
}
