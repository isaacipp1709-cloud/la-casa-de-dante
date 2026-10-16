"use client";

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildCallbackRedirect, buildGitHubOAuthOptions } from './github-oauth';

/**
 * Sesion del navegador con Supabase Auth (unico proveedor de identidad).
 *
 * Mecanismo de intercambio: PKCE explicito con `detectSessionInUrl: false`.
 * El SDK NO intercambia nada automaticamente: el unico intercambio ocurre en
 * /auth/callback con `exchangeCodeForSession`. Nunca ambos.
 */

let cached: SupabaseClient | null = null;

/** Opciones explicitas del cliente (verificables en pruebas). */
export function buildBrowserAuthOptions() {
  return {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // El retorno OAuth se procesa solo en /auth/callback (exchange manual).
      detectSessionInUrl: false,
      flowType: 'pkce' as const,
    },
  };
}

export function readBrowserAuthConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isBrowserAuthConfigured(): boolean {
  return readBrowserAuthConfig() !== null;
}

/** Un unico cliente de navegador, reutilizado por todo el panel. */
export function getBrowserAuthClient(): SupabaseClient | null {
  const config = readBrowserAuthConfig();
  if (!config) return null;
  if (!cached) {
    cached = createClient(config.url, config.anonKey, buildBrowserAuthOptions());
  }
  return cached;
}

/** Inicia el acceso con GitHub hacia la ruta interna fija de retorno. */
export async function signInWithGitHub(): Promise<{ ok: boolean; message?: string }> {
  const client = getBrowserAuthClient();
  if (!client) {
    return { ok: false, message: 'La autenticacion no esta configurada en este entorno.' };
  }

  const redirectTo = buildCallbackRedirect(window.location.origin);
  const { error } = await client.auth.signInWithOAuth(buildGitHubOAuthOptions(redirectTo));
  if (error) return { ok: false, message: 'No se pudo iniciar el acceso con GitHub.' };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const client = getBrowserAuthClient();
  await client?.auth.signOut();
}

export interface OAuthCallbackParams {
  code: string | null;
  error: string | null;
  errorDescription: string | null;
}

/** Lee los parametros del retorno sin registrar codigos, tokens ni URLs. */
export function readOAuthCallbackParams(search: string): OAuthCallbackParams {
  const params = new URLSearchParams(search);
  return {
    code: params.get('code'),
    error: params.get('error') ?? params.get('error_code'),
    errorDescription: params.get('error_description'),
  };
}

/** Mensaje claro para cada fallo del retorno (nunca redirige en bucle). */
export function describeCallbackFailure(params: OAuthCallbackParams): string | null {
  if (params.error) return 'GitHub cancelo o rechazo el acceso.';
  if (!params.code) return 'El retorno no incluyo un codigo de autorizacion.';
  return null;
}

/**
 * Garantiza UN solo intercambio aunque el efecto se ejecute dos veces
 * (StrictMode en desarrollo) o el usuario recargue la pagina.
 */
export function createSingleFlight(): () => boolean {
  let used = false;
  return () => {
    if (used) return false;
    used = true;
    return true;
  };
}

/** Intercambio manual del codigo PKCE. Devuelve el token o un error acotado. */
export async function exchangeOAuthCode(code: string): Promise<{ ok: boolean; message?: string }> {
  const client = getBrowserAuthClient();
  if (!client) return { ok: false, message: 'La autenticacion no esta configurada en este entorno.' };

  const { data, error } = await client.auth.exchangeCodeForSession(code);
  if (error) return { ok: false, message: 'No se pudo completar el acceso. Intentalo de nuevo.' };
  if (!data.session?.access_token) {
    return { ok: false, message: 'La sesion no quedo establecida.' };
  }
  return { ok: true };
}

/** Token de acceso actual para llamar a las rutas internas como Bearer. */
export async function currentAccessToken(): Promise<string | null> {
  const client = getBrowserAuthClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

/** fetch autorizado: adjunta el token de sesion; la identidad nunca va en el cuerpo. */
export async function authorizedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await currentAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', 'Bearer ' + token);
  return fetch(input, { ...init, headers });
}
