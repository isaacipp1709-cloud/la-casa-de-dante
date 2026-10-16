import { danteBridge } from '../dante-bridge';
import { readBearerToken, resolveOwnerFromRequest } from '../auth/server-owner';
import { CredentialService } from './credential-service';
import { InMemoryCredentialStore } from '../credentials/credential-store';
import { createProviderDispatch } from './provider-dispatch';
import { defaultProviderAdapters } from './provider-adapters';
import type { CoreCredentialPort, CredentialHandlerDeps } from './credential-handlers';

/**
 * Cableado de credenciales de La Casa.
 *
 * La Casa NO persiste credenciales: el ciclo completo (cifrado, persistencia en
 * Neon y ejecucion) ocurre en Dante-AI-Core a traves del bridge autenticado, con
 * la identidad del usuario firmada. El store en memoria solo actua como fallback
 * de desarrollo cuando el Core no responde, y se reporta como temporal.
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

export function createCredentialService(): CredentialService {
  return new CredentialService(process.env.CREDENTIAL_MASTER_SECRET, memoryStore());
}

/** Puente al Core: via preferente para crear, listar, eliminar y chatear. */
const corePort: CoreCredentialPort = {
  createCredential: (input) => danteBridge.createCredential(input),
  listCredentials: (ownerId) => danteBridge.listCredentials(ownerId),
  deleteCredential: (ownerId, credentialId) => danteBridge.deleteCredential(ownerId, credentialId),
  chatWithStoredCredential: (input) => danteBridge.chatWithStoredCredential(input),
};

const dispatch = createProviderDispatch(defaultProviderAdapters);

export const credentialHandlerDeps: CredentialHandlerDeps = {
  resolveOwner: (request) => resolveOwnerFromRequest(request),
  createService: createCredentialService,
  dispatch,
  storageMode: () => 'temporary',
  core: corePort,
};

export { readBearerToken };
