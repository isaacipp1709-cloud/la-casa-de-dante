import { NextResponse } from 'next/server';

let providers = [
  { id: '1', name: 'Gemini Pro', category: 'LLM', is_active: true, usageToday: 15, dailyLimit: 100, is_public: true },
  { id: '2', name: 'HuggingFace', category: 'NLP', is_active: true, usageToday: 5, dailyLimit: 50, is_public: true },
  { id: '3', name: 'Ollama', category: 'Local LLM', is_active: false, usageToday: 0, dailyLimit: 1000, is_public: false }
];

export async function GET() {
  return NextResponse.json(providers);
}

export async function POST(request: Request) {
  const data = await request.json();
  const newProvider = {
    id: String(Date.now()),
    name: data.name || 'New Provider',
    category: data.category || 'General',
    is_active: true,
    usageToday: 0,
    dailyLimit: 100,
    is_public: false
  };
  providers.push(newProvider);
  return NextResponse.json(newProvider, { status: 201 });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (id) {
    providers = providers.filter(p => p.id !== id);
  }
  return NextResponse.json({ success: true });
}
