const DANTE_CORE_URL = process.env.DANTE_CORE_URL || 'http://localhost:3001';
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
    const res = await fetch(`${DANTE_CORE_URL}/api/chat`, {
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
    const res = await fetch(`${DANTE_CORE_URL}/api/health`, {
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
    const res = await fetch(`${DANTE_CORE_URL}${endpointPath}`, {
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
    const res = await fetch(`${DANTE_CORE_URL}${endpointPath}`, {
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
    const res = await fetch(`${DANTE_CORE_URL}${endpointPath}`, {
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
