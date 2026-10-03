const DANTE_CORE_URL = process.env.NEXT_PUBLIC_DANTE_CORE_URL || 'http://localhost:3001';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface DanteChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  conversationId?: string;
}

export interface HealthResponse {
  status: string;
  version?: string;
}

export async function chatWithDante(messages: Message[]): Promise<DanteChatResponse> {
  try {
    const res = await fetch(`${DANTE_CORE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Dante Core error: ${res.status} - ${errorText}`);
    }
    
    return res.json();
  } catch (error) {
    console.error('Error calling Dante Core:', error);
    throw error;
  }
}

export async function checkDanteHealth(): Promise<HealthResponse> {
  const res = await fetch(`${DANTE_CORE_URL}/api/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}
