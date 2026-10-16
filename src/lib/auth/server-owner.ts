/**
 * Identidad del propietario resuelta EXCLUSIVAMENTE en el servidor.
 *
 * Reglas:
 * - Nunca se acepta un userId enviado por el navegador (body, query o cabecera no verificada).
 * - La unica fuente valida es un token Bearer verificado contra el servidor de autenticacion.
 * - Sin configuracion de autenticacion se devuelve CONFIGURATION_ERROR (no se inventa identidad).
 */

export interface ServerAuthConfig {
  url: string;
  anonKey: string;
}

export type OwnerResolution =
  | { ok: true; ownerId: string }
  | { ok: false; status: number; code: string; message: string };

export function readServerAuthConfig(env: Record<string, string | undefined>): ServerAuthConfig | null {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** Extrae unicamente el token Bearer. No lee identidad del cliente. */
export function readBearerToken(headers: Headers): string | null {
  const raw = headers.get('authorization') ?? '';
  if (!raw.toLowerCase().startsWith('bearer ')) return null;
  const token = raw.slice(7).trim();
  return token.length > 0 ? token : null;
}

const UNAUTHORIZED: OwnerResolution = {
  ok: false,
  status: 401,
  code: 'UNAUTHORIZED',
  message: 'Authentication required.',
};

const NOT_CONFIGURED: OwnerResolution = {
  ok: false,
  status: 500,
  code: 'CONFIGURATION_ERROR',
  message: 'Server authentication is not configured.',
};

export interface ResolveOwnerDeps {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

/**
 * Verifica el token Bearer contra el servidor de autenticacion y devuelve el id
 * del propietario SOLO desde la respuesta verificada del servidor.
 */
export async function resolveOwnerFromRequest(
  request: Request,
  deps: ResolveOwnerDeps = {},
): Promise<OwnerResolution> {
  const token = readBearerToken(request.headers);
  if (!token) return UNAUTHORIZED;

  const config = readServerAuthConfig(deps.env ?? process.env);
  if (!config) return NOT_CONFIGURED;

  const fetchImpl = deps.fetchImpl ?? fetch;
  try {
    const endpoint = config.url.replace(/\/+$/, '') + '/auth/v1/user';
    const response = await fetchImpl(endpoint, {
      method: 'GET',
      headers: { apikey: config.anonKey, authorization: 'Bearer ' + token },
      cache: 'no-store',
    });
    if (!response.ok) return UNAUTHORIZED;

    const payload: unknown = await response.json();
    const ownerId =
      typeof payload === 'object' && payload !== null && typeof (payload as { id?: unknown }).id === 'string'
        ? (payload as { id: string }).id
        : null;
    if (!ownerId) return UNAUTHORIZED;

    return { ok: true, ownerId };
  } catch {
    return UNAUTHORIZED;
  }
}
