/**
 * Opciones del acceso "Continuar con GitHub" via Supabase Auth.
 *
 * Se solicitan CERO scopes: el inicio de sesion no pide permisos sobre
 * repositorios ni sobre la cuenta. El correo principal solo se usa como dato
 * informativo: la autorizacion real es por owner_id y lista del servidor.
 */
export interface GitHubOAuthOptions {
  provider: 'github';
  options: {
    scopes: string;
    redirectTo?: string;
    queryParams?: Record<string, string>;
  };
}

export function buildGitHubOAuthOptions(redirectTo?: string): GitHubOAuthOptions {
  return {
    provider: 'github',
    options: {
      scopes: '',
      ...(redirectTo ? { redirectTo } : {}),
      queryParams: { prompt: 'select_account' },
    },
  };
}
