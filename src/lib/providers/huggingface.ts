import { z } from 'zod';

const HuggingFaceTaskSchema = z.object({
  text: z.string().min(1).max(8000),
  task: z.enum(['sentiment', 'summary', 'classification']),
});

export function isHuggingFaceConfigured(): boolean {
  return Boolean(process.env.HUGGING_FACE_API_KEY);
}

export async function analyzeWithHF(
  text: string,
  task: 'sentiment' | 'summary' | 'classification'
) {
  const parsed = HuggingFaceTaskSchema.safeParse({ text, task });
  if (!parsed.success) {
    throw new Error('Payload inválido. Operación abortada por dante-bridge.');
  }

  const modelMap: Record<string, string> = {
    sentiment: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
    summary: 'google/pegasus-xsum',
    classification: 'facebook/bart-large-mnli',
  };

  const apiKey = process.env.HUGGING_FACE_API_KEY;
  if (!apiKey) throw new Error('HUGGING_FACE_API_KEY no configurado');

  const response = await fetch(
    `https://api-inference.huggingface.co/models/${modelMap[parsed.data.task]}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: parsed.data.text }),
    }
  );

  if (!response.ok) {
    throw new Error(`HF API error: ${response.statusText}`);
  }

  return response.json();
}
