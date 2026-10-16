import { resolveOwnerFromRequest } from '../auth/server-owner';
import { CredentialService } from './credential-service';
import { InMemoryCredentialStore } from '../credentials/credential-store';
import { createProviderDispatch } from './provider-dispatch';
import { defaultProviderAdapters } from './provider-adapters';
import type { CredentialHandlerDeps } from './credential-handlers';

/**
 * Cableado unico de credenciales para los endpoints de chat.
 *
 * PERSISTENCIA: store en memoria del proceso (globalThis), NO durable:
 * los datos se pierden al reiniciar. La implementacion durable se conecta
 * en un paso posterior mediante el factory de stores.
 */

const globalStore = globalThis as unknown as {
  __danteCredentialMemoryStore?: InMemoryCredentialStore;
};

function memoryStore(): InMemoryCredentialStore {
  if (!globalStore.__danteCredentialMemoryStore) {
    globalStore.__danteCredentialMemoryStore = new InMemoryCredentialStore();
  }
  return globalStore.__danteCredentialMemoryStore;
}

export function createCredentialService(_request?: Request): CredentialService {
  return new CredentialService(process.env.CREDENTIAL_MASTER_SECRET, memoryStore());
}

/** Adaptador real: gemini usa la clave resuelta del propietario autenticado. */
const dispatch = createProviderDispatch(defaultProviderAdapters);

export const credentialHandlerDeps: CredentialHandlerDeps = {
  resolveOwner: (request) => resolveOwnerFromRequest(request),
  createService: createCredentialService,
  dispatch,
};
