/**
 * Normaliza la URL base de Dante-AI-Core:
 * - Recorta espacios en blanco al inicio y al final.
 * - Elimina barras finales redundantes para evitar rutas malformadas (p. ej. //api/chat).
 * - Aplica el valor por defecto ('http://localhost:3001') si la entrada es nula o vacía.
 */
export function normalizeCoreUrl(url?: string | null): string {
  if (url && typeof url === 'string') {
    const trimmed = url.trim();
    if (trimmed) return trimmed.replace(/\/+$/, '');
  }
  // En Vercel o en entorno cloud, no existe localhost:3001 dentro del entorno serverless.
  // El fallback seguro hacia el Core en la nube es su URL canónica oficial.
  if (process.env.VERCEL === '1') {
    return 'https://dante-ai-core.vercel.app';
  }
  return 'http://localhost:3001';
}

/**
 * Resuelve la URL base vigente normalizada desde process.env.DANTE_CORE_URL.
 */
export function getDanteCoreUrl(): string {
  return normalizeCoreUrl(process.env.DANTE_CORE_URL);
}

/**
 * Construye una URL completa y sanitizada hacia un endpoint del Core,
 * garantizando que nunca se produzcan dobles barras diagonales.
 */
export function buildCoreEndpointUrl(endpointPath: string, baseUrl?: string): string {
  const base = normalizeCoreUrl(baseUrl ?? process.env.DANTE_CORE_URL);
  const normalizedPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  return `${base}${normalizedPath}`;
}

export const DANTE_CORE_URL = getDanteCoreUrl();
const DEFAULT_TIMEOUT_MS = 30_000;

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface DanteChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  conversationId?: string;
  persistence?: 'saved' | 'unavailable' | 'disabled';
}

export interface HealthResponse {
  status: string;
  version?: string;
}

/**
 * Calls Dante-AI-Core /api/chat with a configurable timeout.
 * Throws 'TIMEOUT' error on AbortError, 'CORE_ERROR' on non-2xx response.
 */
export async function chatWithDante(
  messages: Message[],
  extraHeaders?: Record<string, string>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<DanteChatResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(buildCoreEndpointUrl('/api/chat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DANTE_CORE_TOKEN || ''}`,
        ...extraHeaders,
      },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ error: 'UNKNOWN' }));
      throw new Error(errorBody.error || 'CORE_ERROR');
    }

    return res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw error;
  }
}

/**
 * Wraps chatWithDante with a single retry on failure.
 * No backoff in this phase — immediate retry.
 */
export async function chatWithDanteWithRetry(
  messages: Message[],
  extraHeaders?: Record<string, string>,
  maxRetries: number = 1,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<DanteChatResponse> {
  let lastError: Error = new Error('UNKNOWN');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await chatWithDante(messages, extraHeaders, timeoutMs);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        // Immediate retry (no backoff in this phase)
        continue;
      }
    }
  }

  throw lastError;
}

export async function checkDanteHealth(
  timeoutMs: number = 5_000
): Promise<HealthResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(buildCoreEndpointUrl('/api/health'), {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw error;
  }
}

/**
 * Generic authenticated GET helper for Dante-AI-Core endpoints with timeout.
 */
export async function fetchFromDanteCore(
  endpointPath: string,
  timeoutMs: number = 8_000,
  extraHeaders?: Record<string, string>
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(buildCoreEndpointUrl(endpointPath), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DANTE_CORE_TOKEN || ''}`,
        ...extraHeaders,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`CORE_HTTP_${res.status}`);
    }

    return res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw error;
  }
}

/**
 * POST autenticado al Core (mismo token del bridge).
 * Lanza 'TIMEOUT' en abort y 'CORE_HTTP_<status>' en respuesta no exitosa.
 */
export async function postToDanteCore(
  endpointPath: string,
  body: unknown,
  timeoutMs: number = 8_000,
  extraHeaders?: Record<string, string>
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(buildCoreEndpointUrl(endpointPath), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DANTE_CORE_TOKEN || ''}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`CORE_HTTP_${res.status}`);
    }

    return res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw error;
  }
}

/** DELETE autenticado al Core, con identidad firmada opcional. */
export async function deleteFromDanteCore(
  endpointPath: string,
  extraHeaders?: Record<string, string>,
  timeoutMs: number = 8_000
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(buildCoreEndpointUrl(endpointPath), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DANTE_CORE_TOKEN || ''}`,
        ...extraHeaders,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`CORE_HTTP_${res.status}`);
    return res.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') throw new Error('TIMEOUT');
    throw error;
  }
}
