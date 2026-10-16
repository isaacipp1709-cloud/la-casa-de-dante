import { readBearerToken, resolveOwnerFromRequest } from '../auth/server-owner';
import { CredentialService } from './credential-service';
import { getCredentialStorageMode, getCredentialStore } from '../credentials/credential-store-factory';
import { createProviderDispatch } from './provider-dispatch';
import { defaultProviderAdapters } from './provider-adapters';
import type { CredentialHandlerDeps } from './credential-handlers';

/**
 * Cableado unico de credenciales para los endpoints de chat.
 *
 * PERSISTENCIA: durable (Supabase) cuando existen SUPABASE_URL y SUPABASE_ANON_KEY;
 * en caso contrario cae al store en memoria del proceso, que NO es durable:
 * los datos se pierden al reiniciar. El fallback nunca se elimina.
 *
 * El cliente durable se crea por solicitud con el token del usuario autenticado
 * (clave anon, nunca service_role) para que RLS aplique con auth.uid().
 */

export function createCredentialService(request?: Request): CredentialService {
  const accessToken = request ? readBearerToken(request.headers) ?? undefined : undefined;
  return new CredentialService(
    process.env.CREDENTIAL_MASTER_SECRET,
    getCredentialStore({ accessToken }),
  );
}

/** Adaptador real: gemini usa la clave resuelta del propietario autenticado. */
const dispatch = createProviderDispatch(defaultProviderAdapters);

export const credentialHandlerDeps: CredentialHandlerDeps = {
  resolveOwner: (request) => resolveOwnerFromRequest(request),
  createService: createCredentialService,
  dispatch,
  storageMode: () => getCredentialStorageMode(),
};
