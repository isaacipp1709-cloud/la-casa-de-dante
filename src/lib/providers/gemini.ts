import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { DanteChatMessageSchema } from '@/contracts/dante';
import { Message } from '../dante-bridge/client';

const ProviderMessagesSchema = z.array(DanteChatMessageSchema).min(1);

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

/**
 * Modelos vigentes aprobados de Google Gemini API con nivel gratuito estándar documentado.
 * Ordenados para que la selección inicial (índice 0) sea el modelo aprobado por defecto.
 */
export const ALLOWED_GEMINI_MODELS = [
  DEFAULT_GEMINI_MODEL,
  'gemini-3.5-flash-lite',
] as const;

export type AllowedGeminiModel = (typeof ALLOWED_GEMINI_MODELS)[number];

export class InvalidGeminiModelError extends Error {
  readonly code = 'INVALID_MODEL';
  readonly requestedModel: string;

  constructor(requestedModel: string) {
    super(
      `El modelo Gemini '${requestedModel}' está obsoleto o no está permitido. Modelos permitidos: ${ALLOWED_GEMINI_MODELS.join(', ')}.`,
    );
    this.name = 'InvalidGeminiModelError';
    this.requestedModel = requestedModel;
  }
}

export function isAllowedGeminiModel(model: string): model is AllowedGeminiModel {
  return (ALLOWED_GEMINI_MODELS as readonly string[]).includes(model);
}

/**
 * Resuelve y valida el modelo Gemini efectivo:
 * - Sin modelo explícito: usa process.env.DEFAULT_GEMINI_MODEL (validado) o DEFAULT_GEMINI_MODEL ('gemini-3.8-flash').
 * - Con modelo explícito permitido: lo preserva sin cambios.
 * - Con un override obsoleto o no permitido (p. ej. 'gemini-2.0-flash'): lanza InvalidGeminiModelError.
 */
export function resolveGeminiModel(requestedModel?: string | null): AllowedGeminiModel {
  const explicit = typeof requestedModel === 'string' ? requestedModel.trim() : '';
  if (explicit.length > 0) {
    if (!isAllowedGeminiModel(explicit)) {
      throw new InvalidGeminiModelError(explicit);
    }
    return explicit;
  }

  const envDefault =
    typeof process.env.DEFAULT_GEMINI_MODEL === 'string'
      ? process.env.DEFAULT_GEMINI_MODEL.trim()
      : '';
  if (envDefault.length > 0) {
    if (!isAllowedGeminiModel(envDefault)) {
      throw new InvalidGeminiModelError(envDefault);
    }
    return envDefault;
  }

  return DEFAULT_GEMINI_MODEL;
}

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

  const resolvedModel = resolveGeminiModel(options.model);

  // La clave explicita (BYOK) tiene prioridad; el entorno queda como respaldo local.
  const apiKey =
    options.apiKey?.trim() || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY no configurado');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: resolvedModel,
  });

  const prompt = parsed.data
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');
  const result = await model.generateContent(prompt);
  return result.response.text();
}
