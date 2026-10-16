import { ProviderUnsupportedError } from './provider-errors';

/** Roles aceptados por los adaptadores. */
export type ProviderRole = 'user' | 'assistant' | 'system';

export interface ProviderDispatchInput {
  providerId: string;
  model?: string;
  /** Clave descifrada: existe solo durante la ejecucion de la solicitud. */
  apiKey: string;
  messages: Array<{ role: ProviderRole; content: string }>;
}

export type ProviderDispatch = (input: ProviderDispatchInput) => Promise<{ content: string }>;
export type ProviderAdapter = (input: ProviderDispatchInput) => Promise<{ content: string }>;
export type ProviderAdapters = Partial<Record<string, ProviderAdapter>>;

/** Proveedores con adaptador real habilitado en este incremento. */
export const SUPPORTED_PROVIDERS: readonly string[] = ['gemini'];

/**
 * Construye el despachador. Si el proveedor no tiene adaptador, lanza
 * ProviderUnsupportedError: nunca cae a mock ni simula exito.
 */
export function createProviderDispatch(adapters: ProviderAdapters): ProviderDispatch {
  return async (input) => {
    const adapter = adapters[input.providerId];
    if (!adapter) throw new ProviderUnsupportedError();
    return adapter(input);
  };
}
