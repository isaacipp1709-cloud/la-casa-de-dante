import { Message } from '../dante-bridge/client';

export async function chatWithOllama(messages: Message[]) {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  
  const prompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || 'llama3',
      prompt: prompt,
      stream: false
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }
  
  return response.json();
}
