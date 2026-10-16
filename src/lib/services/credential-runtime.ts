import { resolveOwnerFromRequest } from '../auth/server-owner';
import { CredentialService, type CredentialRecord } from './credential-service';
import { createProviderDispatch } from './provider-dispatch';
import { defaultProviderAdapters } from './provider-adapters';
import type { CredentialHandlerDeps } from './credential-handlers';

/**
 * Cableado unico de credenciales para los endpoints de chat.
 *
 * PERSISTENCIA: el store es un Map en memoria del proceso (globalThis), NO durable
 * y NO apto para produccion. No hay migraciones ni base de datos remota.
 */

const globalStore = globalThis as unknown as {
  __danteCredentialStore?: Map<string, CredentialRecord>;
};

export function createCredentialService(): CredentialService {
  if (!globalStore.__danteCredentialStore) {
    globalStore.__danteCredentialStore = new Map<string, CredentialRecord>();
  }
  return new CredentialService(process.env.CREDENTIAL_MASTER_SECRET, globalStore.__danteCredentialStore);
}

/** Adaptador real: gemini usa la clave resuelta del propietario autenticado. */
const dispatch = createProviderDispatch(defaultProviderAdapters);

export const credentialHandlerDeps: CredentialHandlerDeps = {
  resolveOwner: (request) => resolveOwnerFromRequest(request),
  createService: createCredentialService,
  dispatch,
};
