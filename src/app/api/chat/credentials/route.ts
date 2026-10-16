import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnerFromRequest } from '@/lib/auth/server-owner';
import { CredentialService, type CredentialRecord } from '@/lib/services/credential-service';
import {
  handleChatWithCredential,
  type CredentialHandlerDeps,
  type ProviderDispatch,
} from '@/lib/services/credential-handlers';

export const dynamic = 'force-dynamic';

const globalStore = globalThis as unknown as { __danteCredentialStore?: Map<string, CredentialRecord> };

function createService(): CredentialService {
  if (!globalStore.__danteCredentialStore) {
    globalStore.__danteCredentialStore = new Map<string, CredentialRecord>();
  }
  return new CredentialService(process.env.CREDENTIAL_MASTER_SECRET, globalStore.__danteCredentialStore);
}

/**
 * Transporte real hacia el proveedor: pendiente de configuracion explicita.
 * Se devuelve NOT_CONFIGURED en lugar de simular una respuesta del modelo.
 */
const dispatch: ProviderDispatch | undefined = undefined;

const deps: CredentialHandlerDeps = {
  resolveOwner: (request) => resolveOwnerFromRequest(request),
  createService,
  dispatch,
};

export async function POST(request: NextRequest) {
  const result = await handleChatWithCredential(request, deps);
  return NextResponse.json(result.body, { status: result.status });
}
