import { z } from 'zod';
import { DanteChatMessageSchema } from '@/contracts/dante';
import { Message } from '../dante-bridge/client';

const ProviderMessagesSchema = z.array(DanteChatMessageSchema).min(1);

export function isOllamaConfigured(): boolean {
  return Boolean(process.env.OLLAMA_BASE_URL);
}

export async function chatWithOllama(messages: Message[]) {
  const parsed = ProviderMessagesSchema.safeParse(messages);
  if (!parsed.success) {
    throw new Error('Payload inválido. Operación abortada por dante-bridge.');
  }

  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const prompt = parsed.data
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || 'llama3',
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  return response.json();
}
