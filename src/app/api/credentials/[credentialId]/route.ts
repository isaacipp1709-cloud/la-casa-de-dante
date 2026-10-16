import { NextRequest, NextResponse } from 'next/server';
import { handleDeleteCredential } from '@/lib/services/credential-handlers';
import { credentialHandlerDeps } from '@/lib/services/credential-runtime';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, context: { params: { credentialId: string } }) {
  const result = await handleDeleteCredential(request, context.params.credentialId, credentialHandlerDeps);
  return NextResponse.json(result.body, { status: result.status });
}
