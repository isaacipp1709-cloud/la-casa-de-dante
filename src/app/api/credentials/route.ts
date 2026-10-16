import { NextRequest, NextResponse } from 'next/server';
import { handleListCredentials, handleSaveCredential } from '@/lib/services/credential-handlers';
import { credentialHandlerDeps } from '@/lib/services/credential-runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const result = await handleListCredentials(request, credentialHandlerDeps);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await handleSaveCredential(request, credentialHandlerDeps);
  return NextResponse.json(result.body, { status: result.status });
}
