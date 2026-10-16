import { NextRequest, NextResponse } from 'next/server';
import { handleChatWithCredential } from '@/lib/services/credential-handlers';
import { credentialHandlerDeps } from '@/lib/services/credential-runtime';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const result = await handleChatWithCredential(request, credentialHandlerDeps);
  return NextResponse.json(result.body, { status: result.status });
}
