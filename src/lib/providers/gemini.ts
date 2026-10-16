import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { DanteChatMessageSchema } from '@/contracts/dante';
import { Message } from '../dante-bridge/client';

const ProviderMessagesSchema = z.array(DanteChatMessageSchema).min(1);

export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

export interface ChatWithGeminiOptions {
  /**
   * Clave resuelta por el servicio de credenciales BYOK.
   * Vive solo durante la solicitud: no se persiste, no se registra y no se devuelve.
   */
  apiKey?: string;
  model?: string;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY);
}

export async function chatWithGemini(messages: Message[], options: ChatWithGeminiOptions = {}) {
  const parsed = ProviderMessagesSchema.safeParse(messages);
  if (!parsed.success) {
    throw new Error('Payload inválido. Operación abortada por dante-bridge.');
  }

  // La clave explicita (BYOK) tiene prioridad; el entorno queda como respaldo local.
  const apiKey =
    options.apiKey?.trim() || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY no configurado');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: options.model?.trim() || DEFAULT_GEMINI_MODEL,
  });

  const prompt = parsed.data
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');
  const result = await model.generateContent(prompt);
  return result.response.text();
}
