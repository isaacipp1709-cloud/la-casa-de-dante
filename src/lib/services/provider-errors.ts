/**
 * Taxonomia de fallos del proveedor y su clasificacion.
 * Los mensajes son genericos: no incluyen la clave, URLs internas ni detalles del upstream.
 */

export class ProviderExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderExecutionError';
  }
}

/** El proveedor no tiene adaptador real en este incremento. */
export class ProviderUnsupportedError extends ProviderExecutionError {
  constructor() {
    super('Provider not supported');
    this.name = 'ProviderUnsupportedError';
  }
}

/** El proveedor rechazo la credencial (API key invalida, revocada o sin permisos). */
export class ProviderAuthError extends ProviderExecutionError {
  constructor() {
    super('Provider rejected the credential');
    this.name = 'ProviderAuthError';
  }
}

/** Limite de uso o cuota alcanzada. */
export class ProviderRateLimitError extends ProviderExecutionError {
  constructor() {
    super('Provider rate limit reached');
    this.name = 'ProviderRateLimitError';
  }
}

/** Timeout de red o de respuesta del proveedor. */
export class ProviderTimeoutError extends ProviderExecutionError {
  constructor() {
    super('Provider request timed out');
    this.name = 'ProviderTimeoutError';
  }
}

/** Fallo de red (DNS, conexion rechazada, corte). */
export class ProviderNetworkError extends ProviderExecutionError {
  constructor() {
    super('Provider network failure');
    this.name = 'ProviderNetworkError';
  }
}

/** Error no clasificado devuelto por el proveedor. */
export class ProviderResponseError extends ProviderExecutionError {
  constructor() {
    super('Provider request failed');
    this.name = 'ProviderResponseError';
  }
}

const NETWORK_CODES = ['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH'];
const TIMEOUT_CODES = ['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'];

function readField(error: unknown, key: 'status' | 'code' | 'message'): unknown {
  if (typeof error !== 'object' || error === null) return undefined;
  return (error as Record<string, unknown>)[key];
}

/** Convierte un error crudo del SDK en un error tipado y sanitizado. */
export function classifyProviderError(error: unknown): ProviderExecutionError {
  if (error instanceof ProviderExecutionError) return error;

  const status = readField(error, 'status');
  const code = readField(error, 'code');
  const message = typeof readField(error, 'message') === 'string' ? String(readField(error, 'message')).toLowerCase() : '';
  const codeText = typeof code === 'string' ? code.toUpperCase() : '';

  if (status === 429) return new ProviderRateLimitError();
  if (status === 400 || status === 401 || status === 403) return new ProviderAuthError();
  if (status === 408 || status === 504) return new ProviderTimeoutError();
  if (TIMEOUT_CODES.includes(codeText)) return new ProviderTimeoutError();
  if (NETWORK_CODES.includes(codeText)) return new ProviderNetworkError();
  if (message.includes('timeout') || message.includes('timed out') || message.includes('etimedout')) {
    return new ProviderTimeoutError();
  }
  if (message.includes('fetch failed') || message.includes('network') || message.includes('econn')) {
    return new ProviderNetworkError();
  }
  if (message.includes('api key') || message.includes('api_key') || message.includes('permission') || message.includes('unauthorized')) {
    return new ProviderAuthError();
  }
  if (message.includes('quota') || message.includes('rate limit') || message.includes('resource_exhausted')) {
    return new ProviderRateLimitError();
  }
  return new ProviderResponseError();
}
