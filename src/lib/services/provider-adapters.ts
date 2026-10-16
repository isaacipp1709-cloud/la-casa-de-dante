import { classifyProviderError } from './provider-errors';
import type { ProviderAdapters } from './provider-dispatch';

/**
 * Adaptadores reales. El import del SDK es dinamico para que este modulo pueda
 * importarse en pruebas sin inicializar clientes ni tocar la red.
 */
export const defaultProviderAdapters: ProviderAdapters = {
  gemini: async (input) => {
    try {
      const { chatWithGemini } = await import('../providers/gemini');
      const content = await chatWithGemini(input.messages, {
        apiKey: input.apiKey,
        model: input.model,
      });
      return { content };
    } catch (error) {
      // Se clasifica para no propagar mensajes crudos del SDK (podrian incluir la URL o la clave).
      throw classifyProviderError(error);
    }
  },
};
