export async function analyzeWithHF(text: string, task: 'sentiment' | 'summary' | 'classification') {
  const modelMap: Record<string, string> = {
    sentiment: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
    summary: 'google/pegasus-xsum',
    classification: 'facebook/bart-large-mnli',
  };
  
  const apiKey = process.env.HUGGING_FACE_API_KEY;
  if (!apiKey) throw new Error('HUGGING_FACE_API_KEY no configurado');

  const response = await fetch(
    `https://api-inference.huggingface.co/models/${modelMap[task]}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
    }
  );
  
  if (!response.ok) {
    throw new Error(`HF API error: ${response.statusText}`);
  }
  
  return response.json();
}
