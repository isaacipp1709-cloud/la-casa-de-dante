import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { DanteChatMessageSchema } from '@/contracts/dante';
import { Message } from '../dante-bridge/client';

const ProviderMessagesSchema = z.array(DanteChatMessageSchema).min(1);

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY);
}

export async function chatWithGemini(messages: Message[]) {
  const parsed = ProviderMessagesSchema.safeParse(messages);
  if (!parsed.success) {
    throw new Error('Payload inválido. Operación abortada por dante-bridge.');
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY no configurado');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = parsed.data
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');
  const result = await model.generateContent(prompt);
  return result.response.text();
}
