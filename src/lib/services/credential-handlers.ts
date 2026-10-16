import {
  CredentialConfigurationError,
  CredentialIntegrityError,
  CredentialNotFoundError,
  CredentialService,
  UnsupportedProviderError,
  isAllowedProvider,
} from './credential-service';
import type { OwnerResolution } from '../auth/server-owner';
import {
  ProviderAuthError,
  ProviderNetworkError,
  ProviderRateLimitError,
  ProviderResponseError,
  ProviderTimeoutError,
  ProviderUnsupportedError,
} from './provider-errors';
import type { ProviderDispatch, ProviderRole } from './provider-dispatch';

/**
 * Logica de los endpoints BYOK, con dependencias inyectables para poder probarla
 * sin servicios externos. Los handlers NO aceptan identidad del cliente:
 * el ownerId solo puede venir de deps.resolveOwner (verificacion server-side).
 */

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

export interface CredentialHandlerDeps {
  resolveOwner: (request: Request) => Promise<OwnerResolution>;
  createService: () => CredentialService;
  /** Transporte hacia el proveedor real. Sin el, la ejecucion no es posible. */
  dispatch?: ProviderDispatch;
}

function fail(status: number, code: string, message: string): HandlerResult {
  return { status, body: { error: { code, message } } };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

const ALLOWED_ROLES: readonly ProviderRole[] = ['user', 'assistant', 'system'];

/** Solo rol valido y contenido no vacio: cualquier otro campo del cliente (incluida una clave) se descarta. */
function sanitizeMessages(value: unknown): Array<{ role: ProviderRole; content: string }> {
  if (!Array.isArray(value)) return [];
  const cleaned: Array<{ role: ProviderRole; content: string }> = [];
  for (const entry of value) {
    const item = asRecord(entry);
    const role = item.role;
    const content = item.content;
    if (typeof role === 'string' && typeof content === 'string' && content.trim().length > 0) {
      if ((ALLOWED_ROLES as readonly string[]).includes(role)) {
        cleaned.push({ role: role as ProviderRole, content });
      }
    }
  }
  return cleaned;
}

async function requireOwner(
  request: Request,
  deps: CredentialHandlerDeps,
): Promise<{ ok: true; ownerId: string } | { ok: false; result: HandlerResult }> {
  const resolution = await deps.resolveOwner(request);
  if (!resolution.ok) {
    return { ok: false, result: fail(resolution.status, resolution.code, resolution.message) };
  }
  return { ok: true, ownerId: resolution.ownerId };
}

function requireService(
  deps: CredentialHandlerDeps,
): { ok: true; service: CredentialService } | { ok: false; result: HandlerResult } {
  try {
    return { ok: true, service: deps.createService() };
  } catch (error) {
    if (error instanceof CredentialConfigurationError) {
      return { ok: false, result: fail(500, 'CONFIGURATION_ERROR', error.message) };
    }
    return { ok: false, result: fail(500, 'INTERNAL_ERROR', 'Credential service unavailable.') };
  }
}

async function readJsonBody(request: Request): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; result: HandlerResult }> {
  try {
    const parsed: unknown = await request.json();
    return { ok: true, body: asRecord(parsed) };
  } catch {
    return { ok: false, result: fail(400, 'INVALID_REQUEST', 'JSON payload is invalid.') };
  }
}

/** Traduce respuestas y fallos del proveedor a codigos estables sin filtrar detalles sensibles. */
function mapProviderFailure(error: unknown): HandlerResult {
  if (error instanceof ProviderUnsupportedError) {
    return fail(501, 'PROVIDER_NOT_SUPPORTED', 'The selected provider is not supported yet.');
  }
  if (error instanceof ProviderAuthError) {
    return fail(401, 'PROVIDER_UNAUTHORIZED', 'The provider rejected the stored credential.');
  }
  if (error instanceof ProviderRateLimitError) {
    return fail(429, 'PROVIDER_RATE_LIMITED', 'The provider rate limit has been reached.');
  }
  if (error instanceof ProviderTimeoutError) {
    return fail(504, 'PROVIDER_TIMEOUT', 'The provider request timed out.');
  }
  if (error instanceof ProviderNetworkError) {
    return fail(502, 'PROVIDER_NETWORK_ERROR', 'Could not reach the provider.');
  }
  if (error instanceof ProviderResponseError) {
    return fail(502, 'PROVIDER_ERROR', 'The provider request failed.');
  }
  return fail(500, 'INTERNAL_ERROR', 'Unexpected server error.');
}

/** POST /api/credentials: guarda la clave cifrada y devuelve solo metadatos. */
export async function handleSaveCredential(request: Request, deps: CredentialHandlerDeps): Promise<HandlerResult> {
  const owner = await requireOwner(request, deps);
  if (!owner.ok) return owner.result;

  const serviceResult = requireService(deps);
  if (!serviceResult.ok) return serviceResult.result;

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.result;

  const providerId = typeof parsed.body.providerId === 'string' ? parsed.body.providerId : '';
  const apiKey = typeof parsed.body.apiKey === 'string' ? parsed.body.apiKey : '';
  const model = typeof parsed.body.model === 'string' ? parsed.body.model : undefined;

  if (!isAllowedProvider(providerId)) {
    return fail(400, 'INVALID_REQUEST', 'providerId is not allowed.');
  }
  if (apiKey.trim().length === 0) {
    return fail(400, 'INVALID_REQUEST', 'apiKey is required.');
  }

  try {
    const metadata = serviceResult.service.save({ ownerId: owner.ownerId, providerId, apiKey, model });
    return { status: 201, body: { saved: true, credential: metadata } };
  } catch (error) {
    if (error instanceof UnsupportedProviderError) {
      return fail(400, 'INVALID_REQUEST', 'providerId is not allowed.');
    }
    if (error instanceof CredentialConfigurationError) {
      return fail(500, 'CONFIGURATION_ERROR', error.message);
    }
    return fail(500, 'INTERNAL_ERROR', 'Failed to save credential.');
  }
}

/** GET /api/credentials: solo metadatos del propietario autenticado. */
export async function handleListCredentials(request: Request, deps: CredentialHandlerDeps): Promise<HandlerResult> {
  const owner = await requireOwner(request, deps);
  if (!owner.ok) return owner.result;

  const serviceResult = requireService(deps);
  if (!serviceResult.ok) return serviceResult.result;

  return { status: 200, body: { credentials: serviceResult.service.listMetadata(owner.ownerId) } };
}

/**
 * POST /api/chat/credentials: resuelve el credentialId del propietario autenticado,
 * descifra la clave y ejecuta el proveedor real. La clave nunca sale de este alcance.
 */
export async function handleChatWithCredential(request: Request, deps: CredentialHandlerDeps): Promise<HandlerResult> {
  const owner = await requireOwner(request, deps);
  if (!owner.ok) return owner.result;

  const serviceResult = requireService(deps);
  if (!serviceResult.ok) return serviceResult.result;

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.result;

  const credentialId = typeof parsed.body.credentialId === 'string' ? parsed.body.credentialId : '';
  if (credentialId.length === 0) {
    return fail(400, 'INVALID_REQUEST', 'credentialId is required.');
  }

  // Verificacion de propietario antes de tocar la clave.
  let resolved: { providerId: string; model?: string; apiKey: string };
  try {
    resolved = serviceResult.service.resolveForOwner(credentialId, owner.ownerId);
  } catch (error) {
    // Inexistente y ajena devuelven el mismo error generico: no se filtra existencia.
    if (error instanceof CredentialNotFoundError || error instanceof CredentialIntegrityError) {
      return fail(404, 'NOT_FOUND', 'Credential not found.');
    }
    return fail(500, 'INTERNAL_ERROR', 'Failed to resolve credential.');
  }

  if (!deps.dispatch) {
    return fail(500, 'INTERNAL_ERROR', 'Provider dispatch is unavailable.');
  }

  const messages = sanitizeMessages(parsed.body.messages);
  if (messages.length === 0) {
    return fail(400, 'INVALID_REQUEST', 'At least one valid message is required.');
  }

  try {
    // La clave descifrada solo existe en este frame y no se registra.
    const result = await deps.dispatch({
      providerId: resolved.providerId,
      model: resolved.model,
      apiKey: resolved.apiKey,
      messages,
    });
    return {
      status: 200,
      body: {
        content: result.content,
        providerId: resolved.providerId,
        model: resolved.model,
        credentialId,
        usedCredential: true,
      },
    };
  } catch (error) {
    return mapProviderFailure(error);
  }
}
