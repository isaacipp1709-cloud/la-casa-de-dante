import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { InMemoryCredentialStore, type CredentialStore } from './credential-store';
import { SupabaseCredentialStore } from './supabase-credential-store';

/**
 * Seleccion del store de credenciales.
 *
 * - Con SUPABASE_URL + SUPABASE_ANON_KEY: store durable (Supabase).
 * - Sin configuracion: store en memoria (fallback de desarrollo, NO durable).
 *
 * El cliente es de servidor: clave anon (nunca service_role) y, cuando existe,
 * el token del usuario autenticado para que RLS aplique con auth.uid().
 */

export type CredentialStorageMode = 'durable' | 'memory';

export interface SupabaseCredentialConfig {
  url: string;
  anonKey: string;
}

export function readSupabaseCredentialConfig(
  env: Record<string, string | undefined> = process.env,
): SupabaseCredentialConfig | null {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function getCredentialStorageMode(
  env: Record<string, string | undefined> = process.env,
): CredentialStorageMode {
  return readSupabaseCredentialConfig(env) ? 'durable' : 'memory';
}

/** Store en memoria compartido por proceso: mantiene el comportamiento actual. */
const globalState = globalThis as unknown as {
  __danteCredentialMemoryStore?: InMemoryCredentialStore;
};

function memoryStore(): InMemoryCredentialStore {
  if (!globalState.__danteCredentialMemoryStore) {
    globalState.__danteCredentialMemoryStore = new InMemoryCredentialStore();
  }
  return globalState.__danteCredentialMemoryStore;
}

let cachedServerClient: SupabaseClient | null = null;

function serverClient(config: SupabaseCredentialConfig, accessToken?: string): SupabaseClient {
  // Con token del usuario se crea un cliente acotado a esa sesion (no se cachea
  // para no mezclar identidades). Sin token se reutiliza el cliente de servidor.
  if (accessToken) {
    return createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  }
  if (!cachedServerClient) {
    cachedServerClient = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedServerClient;
}

export interface GetCredentialStoreOptions {
  accessToken?: string;
  env?: Record<string, string | undefined>;
}

/** Unico punto de acceso al store de credenciales. */
export function getCredentialStore(options: GetCredentialStoreOptions = {}): CredentialStore {
  const env = options.env ?? process.env;
  const config = readSupabaseCredentialConfig(env);
  if (!config) return memoryStore();
  return new SupabaseCredentialStore(serverClient(config, options.accessToken));
}
