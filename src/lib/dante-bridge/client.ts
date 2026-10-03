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

export async function checkDanteHealth(): Promise<HealthResponse> {
  const res = await fetch(`${DANTE_CORE_URL}/api/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}
