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

/**
 * Almacenamiento volatil estrictamente en memoria (RAM de la pestaña).
 * Diseñado para terminales publicas (universidades, bibliotecas):
 * Ningun token de sesion, JWT ni clave privada sobrevive al cierre de la pestaña o navegador.
 */
const volatileMemoryStorage = new Map<string, string>();

export function getClientSessionMemory(): Map<string, string> {
  return volatileMemoryStorage;
}

export function clearClientSessionMemory(): void {
  volatileMemoryStorage.clear();
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.clear();
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const key = window.localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      // Ignorar restricciones en entornos sin acceso a storage
    }
  }
}

/** Adaptador de almacenamiento que aisla tokens en memoria volatil */
export const browserAuthStorage = {
  getItem: (key: string): string | null => {
    // El verifier de PKCE debe sobrevivir al salto temporal hacia GitHub OAuth y de vuelta a /auth/callback
    if (key.includes('code-verifier')) {
      if (typeof window !== 'undefined') {
        try {
          return window.sessionStorage.getItem(key);
        } catch {
          return null;
        }
      }
    }
    // Todos los tokens de autenticacion (sesion, access_token, refresh_token) viven SOLO en memoria volatil
    return volatileMemoryStorage.get(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    if (key.includes('code-verifier')) {
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(key, value);
        } catch {}
      }
      return;
    }
    // Sesion guardada unicamente en memoria volatil
    volatileMemoryStorage.set(key, value);
    // Garantizar que no se escriba en almacenamiento persistente
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(key);
        window.sessionStorage.removeItem(key);
      } catch {}
    }
  },
  removeItem: (key: string): void => {
    volatileMemoryStorage.delete(key);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(key);
        window.localStorage.removeItem(key);
      } catch {}
    }
  },
};

/** Opciones explicitas del cliente (verificables en pruebas). */
export function buildBrowserAuthOptions() {
  return {
    auth: {
      storage: browserAuthStorage,
      persistSession: true,
      autoRefreshToken: true,
      // El retorno OAuth se procesa solo en /auth/callback (exchange manual).
      detectSessionInUrl: false,
      flowType: 'pkce' as const,
    },
  };
}

export function normalizeSupabaseUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  let trimmed = raw.trim();
  const mdMatch = trimmed.match(/\[.*?\]\((https?:\/\/[^\s)]+)\)/);
  if (mdMatch) {
    trimmed = mdMatch[1].trim();
  }
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  if (!trimmed) return null;
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = 'https://' + trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch {
    return null;
  }
}

export function readBrowserAuthConfig(): { url: string; anonKey: string } | null {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
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
  try {
    await client?.auth.signOut();
  } finally {
    clearClientSessionMemory();
  }
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

export const LOGIN_TIMEOUT_MS = 15_000;
export const LOGIN_TIMEOUT_MESSAGE = 'El inicio de sesión tomó demasiado tiempo. Por favor intenta de nuevo.';

export interface SignInExecutionOptions {
  timeoutMs?: number;
  onStateChange: (state: { busy: boolean; message: string | null }) => void;
  timerApi?: {
    setTimeout: (fn: () => void, ms: number) => unknown;
    clearTimeout: (id: unknown) => void;
  };
}

/**
 * Ejecuta el flujo de inicio de sesión con guardas de seguridad completas:
 * - try ... finally garantizando que busy vuelva a false si ocurre un error o rechazo.
 * - Temporizador de seguridad (15 s) para desbloquear el botón si la redirección no se completa.
 */
export async function executeSignInWithGuards(
  signInFn: () => Promise<{ ok: boolean; message?: string }>,
  options: SignInExecutionOptions
): Promise<{ ok: boolean; message?: string | null }> {
  const timeoutMs = options.timeoutMs ?? LOGIN_TIMEOUT_MS;
  const timer = options.timerApi ?? {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id as NodeJS.Timeout),
  };

  options.onStateChange({ busy: true, message: null });

  let timerId: unknown = timer.setTimeout(() => {
    timerId = null;
    options.onStateChange({ busy: false, message: LOGIN_TIMEOUT_MESSAGE });
  }, timeoutMs);

  let hasError = false;
  let finalMessage: string | null = null;
  let success = false;

  try {
    const result = await signInFn();
    if (!result.ok) {
      hasError = true;
      finalMessage = result.message ?? 'No se pudo iniciar el acceso.';
    } else {
      success = true;
    }
  } catch (err) {
    hasError = true;
    const detail = err instanceof Error ? err.message : 'Error inesperado al conectar con el proveedor.';
    finalMessage = `No se pudo iniciar el acceso: ${detail}`;
  } finally {
    if (hasError) {
      if (timerId !== null) {
        timer.clearTimeout(timerId);
        timerId = null;
      }
      options.onStateChange({ busy: false, message: finalMessage });
    }
  }

  return { ok: success, message: finalMessage };
}

export interface OAuthCallbackExecutionOptions {
  exchangeFn?: (code: string) => Promise<{ ok: boolean; message?: string }>;
  onSuccess: () => void;
  onFailure: (message: string) => void;
}

/**
 * Ejecuta el intercambio manual PKCE con captura integral de excepciones:
 * - try ... catch garantiza que errores de red o rechazos de promesa no congelen la pantalla
 *   en "Verificando la sesion con Supabase...".
 */
export async function executeOAuthCallbackExchange(
  code: string,
  options: OAuthCallbackExecutionOptions
): Promise<{ ok: boolean; message?: string }> {
  const exchange = options.exchangeFn ?? exchangeOAuthCode;
  try {
    const result = await exchange(code);
    if (!result.ok) {
      const msg = result.message ?? 'No se pudo completar el acceso.';
      options.onFailure(msg);
      return { ok: false, message: msg };
    }
    options.onSuccess();
    return { ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Error inesperado al conectar con el servidor.';
    const msg = `No se pudo completar la verificación del acceso: ${detail}`;
    options.onFailure(msg);
    return { ok: false, message: msg };
  }
}


