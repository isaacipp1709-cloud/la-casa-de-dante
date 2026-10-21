/**
 * Catalogo unico de proveedores aceptados para credenciales BYOK.
 * Modulo seguro para cliente y servidor: sin dependencias de Node.
 */

export interface ByokProvider {
  id: string;
  label: string;
  /** true solo cuando existe adaptador real conectado al despachador. */
  adapterReady: boolean;
}

export const BYOK_PROVIDERS: readonly ByokProvider[] = [
  { id: 'gemini', label: 'Google Gemini', adapterReady: true },
  { id: 'deepseek', label: 'DeepSeek', adapterReady: true },
  { id: 'nvidia', label: 'NVIDIA NIM', adapterReady: true },
  { id: 'groq', label: 'Groq', adapterReady: true },
  { id: 'openrouter', label: 'OpenRouter', adapterReady: true },
  { id: 'huggingface', label: 'Hugging Face', adapterReady: true },
  { id: 'ollama', label: 'Ollama (local)', adapterReady: false },
  { id: 'mock', label: 'Mock local', adapterReady: false },
];

export const BYOK_PROVIDER_IDS: readonly string[] = BYOK_PROVIDERS.map((provider) => provider.id);

export function isAllowedProviderId(value: unknown): boolean {
  return typeof value === 'string' && BYOK_PROVIDER_IDS.includes(value);
}

export function providerLabel(providerId: string): string {
  return BYOK_PROVIDERS.find((provider) => provider.id === providerId)?.label ?? providerId;
}
