import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnerFromRequest } from '@/lib/auth/server-owner';
import { CredentialService, type CredentialRecord } from '@/lib/services/credential-service';
import {
  handleListCredentials,
  handleSaveCredential,
  type CredentialHandlerDeps,
} from '@/lib/services/credential-handlers';

export const dynamic = 'force-dynamic';

/** Store local del proceso. No se ejecutan migraciones remotas en este incremento. */
const globalStore = globalThis as unknown as { __danteCredentialStore?: Map<string, CredentialRecord> };

function createService(): CredentialService {
  if (!globalStore.__danteCredentialStore) {
    globalStore.__danteCredentialStore = new Map<string, CredentialRecord>();
  }
  return new CredentialService(process.env.CREDENTIAL_MASTER_SECRET, globalStore.__danteCredentialStore);
}

const deps: CredentialHandlerDeps = {
  resolveOwner: (request) => resolveOwnerFromRequest(request),
  createService,
};

export async function GET(request: NextRequest) {
  const result = await handleListCredentials(request, deps);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: NextRequest) {
  const result = await handleSaveCredential(request, deps);
  return NextResponse.json(result.body, { status: result.status });
}
