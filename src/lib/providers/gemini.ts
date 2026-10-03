import { GoogleGenerativeAI } from '@google/generative-ai';
import { Message } from '../dante-bridge/client';

export async function chatWithGemini(messages: Message[]) {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY no configurado');
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Use flash for speed
  
  // Format messages for gemini
  const prompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  const result = await model.generateContent(prompt);
  return result.response.text();
}
