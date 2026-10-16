import { randomUUID } from 'node:crypto';
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

/** Claves que el navegador nunca debe enviar: la identidad de la credencial es credentialId. */
const CLIENT_KEY_FIELDS = ['apiKey', 'api_key', 'apikey'];

export function hasClientSuppliedApiKey(body: Record<string, unknown>): boolean {
  return CLIENT_KEY_FIELDS.some((field) => {
    const value = body[field];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

/** Rechaza explicitamente cualquier intento de enviar la clave desde el cliente. */
export function rejectClientSuppliedApiKey(body: Record<string, unknown>): HandlerResult | null {
  if (!hasClientSuppliedApiKey(body)) return null;
  return fail(
    400,
    'INVALID_REQUEST',
    'API keys must not be sent by the client. Use credentialId with a stored credential.',
  );
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

export interface ResolvedExecution {
  content: string;
  providerId: string;
  model?: string;
}

/**
 * Nucleo compartido por /api/chat y /api/chat/credentials: verifica propietario,
 * descifra la clave (vive solo en este frame) y ejecuta el adaptador del proveedor.
 * No duplica logica entre endpoints.
 */
export async function runWithResolvedCredential(
  ownerId: string,
  service: CredentialService,
  dispatch: ProviderDispatch | undefined,
  credentialId: string,
  messages: Array<{ role: ProviderRole; content: string }>,
): Promise<{ ok: true; execution: ResolvedExecution } | { ok: false; result: HandlerResult }> {
  let resolved: { providerId: string; model?: string; apiKey: string };
  try {
    resolved = service.resolveForOwner(credentialId, ownerId);
  } catch (error) {
    // Inexistente y ajena devuelven el mismo error generico: no se filtra existencia.
    if (error instanceof CredentialNotFoundError || error instanceof CredentialIntegrityError) {
      return { ok: false, result: fail(404, 'NOT_FOUND', 'Credential not found.') };
    }
    return { ok: false, result: fail(500, 'INTERNAL_ERROR', 'Failed to resolve credential.') };
  }

  // La falta de despachador no debe ocultar el 404 de una credencial inexistente o ajena.
  if (!dispatch) {
    return { ok: false, result: fail(500, 'INTERNAL_ERROR', 'Provider dispatch is unavailable.') };
  }

  try {
    const result = await dispatch({
      providerId: resolved.providerId,
      model: resolved.model,
      apiKey: resolved.apiKey,
      messages,
    });
    return {
      ok: true,
      execution: { content: result.content, providerId: resolved.providerId, model: resolved.model },
    };
  } catch (error) {
    return { ok: false, result: mapProviderFailure(error) };
  }
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

  const clientKey = rejectClientSuppliedApiKey(parsed.body);
  if (clientKey) return clientKey;

  const credentialId = typeof parsed.body.credentialId === 'string' ? parsed.body.credentialId : '';
  if (credentialId.length === 0) {
    return fail(400, 'INVALID_REQUEST', 'credentialId is required.');
  }

  const messages = sanitizeMessages(parsed.body.messages);
  if (messages.length === 0) {
    return fail(400, 'INVALID_REQUEST', 'At least one valid message is required.');
  }

  const run = await runWithResolvedCredential(
    owner.ownerId,
    serviceResult.service,
    deps.dispatch,
    credentialId,
    messages,
  );
  if (!run.ok) return run.result;

  return {
    status: 200,
    body: {
      content: run.execution.content,
      providerId: run.execution.providerId,
      model: run.execution.model,
      credentialId,
      usedCredential: true,
    },
  };
}

/**
 * POST /api/chat con credentialId: misma resolucion segura que /api/chat/credentials,
 * pero devolviendo el contrato DanteChatResponse que consume la UI.
 */
export async function handleChatWithStoredCredential(request: Request, deps: CredentialHandlerDeps): Promise<HandlerResult> {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.result;
  return handleChatWithStoredCredentialFromBody(request, parsed.body, deps);
}

/**
 * Variante que recibe el body ya parseado: evita volver a leer el stream de la
 * peticion cuando el llamador (POST /api/chat) ya lo consumio para validar el esquema.
 * El request solo se usa para autenticacion (cabeceras).
 */
export async function handleChatWithStoredCredentialFromBody(
  request: Request,
  body: Record<string, unknown>,
  deps: CredentialHandlerDeps,
): Promise<HandlerResult> {
  const owner = await requireOwner(request, deps);
  if (!owner.ok) return owner.result;

  const serviceResult = requireService(deps);
  if (!serviceResult.ok) return serviceResult.result;

  const clientKey = rejectClientSuppliedApiKey(body);
  if (clientKey) return clientKey;

  const credentialId = typeof body.credentialId === 'string' ? body.credentialId : '';
  if (credentialId.length === 0) {
    return fail(400, 'INVALID_REQUEST', 'credentialId is required.');
  }

  const messages = sanitizeMessages(body.messages);
  if (messages.length === 0) {
    return fail(400, 'INVALID_REQUEST', 'At least one valid message is required.');
  }

  const run = await runWithResolvedCredential(
    owner.ownerId,
    serviceResult.service,
    deps.dispatch,
    credentialId,
    messages,
  );
  if (!run.ok) return run.result;

  if (run.execution.content.trim().length === 0) {
    return fail(502, 'PROVIDER_ERROR', 'The provider returned an empty response.');
  }

  return {
    status: 200,
    body: {
      message: {
        role: 'assistant',
        content: run.execution.content,
        timestamp: new Date().toISOString(),
      },
      status: 'success',
      correlationId: randomUUID(),
      providerId: run.execution.providerId,
      model: run.execution.model,
    },
  };
}
