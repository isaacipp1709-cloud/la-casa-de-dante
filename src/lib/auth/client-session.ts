"use client";

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildGitHubOAuthOptions } from './github-oauth';

/**
 * Sesion del navegador con Supabase Auth (unico proveedor de identidad).
 * No hay login propio ni contrasenas: solo OAuth de GitHub sin scopes.
 */

let cached: SupabaseClient | null = null;

export function readBrowserAuthConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isBrowserAuthConfigured(): boolean {
  return readBrowserAuthConfig() !== null;
}

export function getBrowserAuthClient(): SupabaseClient | null {
  const config = readBrowserAuthConfig();
  if (!config) return null;
  if (!cached) {
    cached = createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return cached;
}

/** Inicia el acceso con GitHub (sin scopes de repositorio). */
export async function signInWithGitHub(): Promise<{ ok: boolean; message?: string }> {
  const client = getBrowserAuthClient();
  if (!client) {
    return { ok: false, message: 'La autenticacion no esta configurada en este entorno.' };
  }
  const { error } = await client.auth.signInWithOAuth(buildGitHubOAuthOptions());
  if (error) return { ok: false, message: 'No se pudo iniciar el acceso con GitHub.' };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const client = getBrowserAuthClient();
  await client?.auth.signOut();
}

/** Token de acceso actual para llamar a las rutas internas como Bearer. */
export async function currentAccessToken(): Promise<string | null> {
  const client = getBrowserAuthClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * fetch autorizado: adjunta el token de sesion; nunca envia identidad en el cuerpo.
 */
export async function authorizedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await currentAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', 'Bearer ' + token);
  return fetch(input, { ...init, headers });
}
