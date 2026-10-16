
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Server auth required." } }, { status: 401 });
  }
  
  try {
    const { content, credentialId, providerId, model } = await req.json();
    
    if (!credentialId) {
      return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "credentialId is required. Key not sent in message." } }, { status: 400 });
    }
    
    // Use credentialId to retrieve key from secure store (not from message)
    // This ensures the key is never re-sent in chat messages
    
    return NextResponse.json({
      content,
      providerId,
      model,
      credentialUsed: credentialId,
      note: "Actual LLM call requires server-side credential lookup by credentialId, not message payload."
    }, { status: 200 });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Chat with credential failed." } }, { status: 500 });
  }
}
