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
import type { CredentialMetadata, CredentialStorage } from '../../contracts/connections';
import { InvalidGeminiModelError, resolveGeminiModel } from '../providers/gemini';

/** Contrato minimo de respuesta de chat que La Casa consume del Core. */
export interface ChatResponseLike {
  message: { role: 'user' | 'assistant' | 'system'; content: string; timestamp?: string };
  status: 'success' | 'error';
  correlationId: string;
  providerId?: string;
  model?: string;
  persistence?: 'saved' | 'unavailable' | 'disabled';
}

/**
 * Endpoints de credenciales de La Casa.
 *
 * La Casa NO es dueña de las credenciales: las operaciones se delegan en
 * Dante-AI-Core (que cifra y persiste en Neon). El store en memoria local solo
 * actua como fallback de desarrollo cuando el Core no esta disponible, y en ese
 * caso la respuesta se marca explicitamente como temporal.
 */

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

/** Puerto hacia Dante-AI-Core (cifra, persiste y ejecuta con la credencial). */
export interface CoreCredentialPort {
  createCredential(input: { ownerId: string; providerId: string; apiKey: string }): Promise<{
    storage: CredentialStorage;
    credential: CredentialMetadata;
  }>;
  listCredentials(ownerId: string): Promise<{
    storage: CredentialStorage;
    credentials: CredentialMetadata[];
  }>;
  deleteCredential(
    ownerId: string,
    credentialId: string,
  ): Promise<{ storage: CredentialStorage; credentialId: string }>;
  chatWithStoredCredential(input: {
    ownerId: string;
    credentialId: string;
    messages: Array<{ role: ProviderRole; content: string }>;
    model?: string;
    conversationId?: string;
    timezone?: string;
    locale?: string;
  }): Promise<ChatResponseLike>;
}

export interface CredentialHandlerDeps {
  resolveOwner: (request: Request) => Promise<OwnerResolution>;
  /** Fallback local en memoria (temporal) cuando el Core no responde. */
  createService: (request: Request) => CredentialService;
  /** Transporte local al proveedor, solo para el fallback. */
  dispatch?: ProviderDispatch;
  /** Modo de persistencia del fallback local. */
  storageMode?: () => CredentialStorage;
  /**
   * Habilita la boveda temporal en memoria. Solo para desarrollo explicito
   * (DANTE_CREDENTIALS_FALLBACK=memory); nunca como recuperacion automatica.
   */
  fallbackEnabled?: boolean;
  /** Puente al Core: es la via preferente para todo el ciclo BYOK. */
  core?: CoreCredentialPort;
}

function fail(status: number, code: string, message: string): HandlerResult {
  return { status, body: { error: { code, message } } };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function extractConversationId(body: Record<string, unknown>): string | undefined {
  if (typeof body.conversationId === 'string' && body.conversationId.trim().length > 0) {
    return body.conversationId.trim();
  }
  if (typeof body.sessionId === 'string' && body.sessionId.trim().length > 0) {
    return body.sessionId.trim();
  }
  return undefined;
}

const ALLOWED_ROLES: readonly ProviderRole[] = ['user', 'assistant', 'system'];

/** Solo rol valido y contenido no vacio: cualquier otro campo (incluida una clave) se descarta. */
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

/** Rechaza claves enviadas en operaciones que no las admiten (lectura o borrado). */
export function rejectClientKeyInRequest(request: Request): HandlerResult | null {
  const url = new URL(request.url);
  for (const field of CLIENT_KEY_FIELDS) {
    if (url.searchParams.get(field)) {
      return fail(400, 'INVALID_REQUEST', 'API keys must not be sent by the client.');
    }
  }
  const header = request.headers.get('x-api-key');
  if (typeof header === 'string' && header.trim().length > 0) {
    return fail(400, 'INVALID_REQUEST', 'API keys must not be sent by the client.');
  }
  return null;
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
  request: Request,
  deps: CredentialHandlerDeps,
): { ok: true; service: CredentialService } | { ok: false; result: HandlerResult } {
  try {
    return { ok: true, service: deps.createService(request) };
  } catch (error) {
    if (error instanceof CredentialConfigurationError) {
      return { ok: false, result: fail(500, 'CONFIGURATION_ERROR', error.message) };
    }
    return { ok: false, result: fail(500, 'INTERNAL_ERROR', 'Credential service unavailable.') };
  }
}

async function readJsonBody(
  request: Request,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; result: HandlerResult }> {
  try {
    const parsed: unknown = await request.json();
    return { ok: true, body: asRecord(parsed) };
  } catch {
    return { ok: false, result: fail(400, 'INVALID_REQUEST', 'JSON payload is invalid.') };
  }
}

/** Fallo del Core con respuesta HTTP: no es una caida, es una decision suya. */
function coreHttpStatus(error: unknown): number | null {
  const message = error instanceof Error ? error.message : '';
  const match = /^CORE_HTTP_([0-9]{3})$/.exec(message);
  if (!match) return null;
  return Number(match[1]);
}

function coreFailureResult(status: number): HandlerResult {
  if (status === 400) return fail(400, 'INVALID_REQUEST', 'El Core rechazo la solicitud.');
  if (status === 401 || status === 403) {
    return fail(401, 'PROVIDER_UNAUTHORIZED', 'El Core rechazo la credencial.');
  }
  if (status === 404) return fail(404, 'NOT_FOUND', 'Credential not found.');
  if (status === 429) return fail(429, 'PROVIDER_RATE_LIMITED', 'Limite de uso alcanzado.');
  if (status === 504) return fail(504, 'PROVIDER_TIMEOUT', 'El Core no respondio a tiempo.');
  return fail(502, 'CORE_ERROR', 'Dante-AI-Core no pudo completar la operacion.');
}

/**
 * Intenta la operacion en el Core. Devuelve el resultado o, si el Core no esta
 * disponible (red/timeout/5xx), null para que el llamador use el fallback temporal.
 */
async function tryCore<T>(
  deps: CredentialHandlerDeps,
  operation: (core: CoreCredentialPort) => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; result: HandlerResult } | null> {
  if (!deps.core) return null;
  try {
    return { ok: true, value: await operation(deps.core) };
  } catch (error) {
    const status = coreHttpStatus(error);
    if (status !== null && status >= 400 && status < 500) {
      return { ok: false, result: coreFailureResult(status) };
    }
    return null;
  }
}

/** POST /api/credentials: guarda en el Core (cifrado y persistencia alli). */
export async function handleSaveCredential(
  request: Request,
  deps: CredentialHandlerDeps,
): Promise<HandlerResult> {
  const owner = await requireOwner(request, deps);
  if (!owner.ok) return owner.result;

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.result;

  const providerId = typeof parsed.body.providerId === 'string' ? parsed.body.providerId : '';
  const apiKey = typeof parsed.body.apiKey === 'string' ? parsed.body.apiKey : '';

  if (!isAllowedProvider(providerId)) {
    return fail(400, 'INVALID_REQUEST', 'providerId is not allowed.');
  }
  if (apiKey.trim().length === 0) {
    return fail(400, 'INVALID_REQUEST', 'apiKey is required.');
  }

  const viaCore = await tryCore(deps, (core) =>
    core.createCredential({ ownerId: owner.ownerId, providerId, apiKey }),
  );
  if (viaCore) {
    if (!viaCore.ok) return viaCore.result;
    return {
      status: 201,
      body: { saved: true, storage: viaCore.value.storage, credential: viaCore.value.credential },
    };
  }

  if (!deps.fallbackEnabled) {
    return fail(
      503,
      'UNAVAILABLE',
      'Dante-AI-Core no esta disponible: la credencial no se guardo.',
    );
  }

  const serviceResult = requireService(request, deps);
  if (!serviceResult.ok) return serviceResult.result;

  try {
    const metadata = await serviceResult.service.save({ ownerId: owner.ownerId, providerId, apiKey });
    return {
      status: 201,
      body: { saved: true, storage: 'temporary', credential: metadata, fallback: true },
    };
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

/** GET /api/credentials: metadatos del propietario, resueltos en el Core. */
export async function handleListCredentials(
  request: Request,
  deps: CredentialHandlerDeps,
): Promise<HandlerResult> {
  const clientKey = rejectClientKeyInRequest(request);
  if (clientKey) return clientKey;

  const owner = await requireOwner(request, deps);
  if (!owner.ok) return owner.result;

  const viaCore = await tryCore(deps, (core) => core.listCredentials(owner.ownerId));
  if (viaCore) {
    if (!viaCore.ok) return viaCore.result;
    return {
      status: 200,
      body: { credentials: viaCore.value.credentials, storage: viaCore.value.storage },
    };
  }

  if (!deps.fallbackEnabled) {
    return fail(503, 'UNAVAILABLE', 'Dante-AI-Core no esta disponible para listar credenciales.');
  }

  const serviceResult = requireService(request, deps);
  if (!serviceResult.ok) return serviceResult.result;

  const credentials = await serviceResult.service.listMetadata(owner.ownerId);
  const storage = deps.storageMode ? deps.storageMode() : 'temporary';
  return { status: 200, body: { credentials, storage, fallback: true } };
}

/** DELETE /api/credentials/[credentialId]: elimina solo si es del propietario. */
export async function handleDeleteCredential(
  request: Request,
  credentialId: string,
  deps: CredentialHandlerDeps,
): Promise<HandlerResult> {
  const clientKey = rejectClientKeyInRequest(request);
  if (clientKey) return clientKey;

  const owner = await requireOwner(request, deps);
  if (!owner.ok) return owner.result;

  if (typeof credentialId !== 'string' || credentialId.trim().length === 0) {
    return fail(400, 'INVALID_REQUEST', 'credentialId is required.');
  }

  const viaCore = await tryCore(deps, (core) => core.deleteCredential(owner.ownerId, credentialId));
  if (viaCore) {
    if (!viaCore.ok) return viaCore.result;
    return {
      status: 200,
      body: { deleted: true, credentialId, storage: viaCore.value.storage },
    };
  }

  if (!deps.fallbackEnabled) {
    return fail(503, 'UNAVAILABLE', 'Dante-AI-Core no esta disponible para eliminar credenciales.');
  }

  const serviceResult = requireService(request, deps);
  if (!serviceResult.ok) return serviceResult.result;

  try {
    await serviceResult.service.deleteForOwner(credentialId, owner.ownerId);
    return { status: 200, body: { deleted: true, credentialId, storage: 'temporary', fallback: true } };
  } catch (error) {
    if (error instanceof CredentialNotFoundError) {
      return fail(404, 'NOT_FOUND', 'Credential not found.');
    }
    return fail(500, 'INTERNAL_ERROR', 'Failed to delete credential.');
  }
}

/** Errores del adaptador local (solo fallback). */
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

/** Resolucion local (solo fallback): la credencial vive en el store temporal. */
export async function runWithResolvedCredential(
  ownerId: string,
  service: CredentialService,
  dispatch: ProviderDispatch | undefined,
  credentialId: string,
  messages: Array<{ role: ProviderRole; content: string }>,
  modelOverride?: string,
): Promise<{ ok: true; execution: ResolvedExecution } | { ok: false; result: HandlerResult }> {
  let resolved: { providerId: string; apiKey: string };
  try {
    resolved = await service.resolveForOwner(credentialId, ownerId);
  } catch (error) {
    if (error instanceof CredentialNotFoundError || error instanceof CredentialIntegrityError) {
      return { ok: false, result: fail(404, 'NOT_FOUND', 'Credential not found.') };
    }
    return { ok: false, result: fail(500, 'INTERNAL_ERROR', 'Failed to resolve credential.') };
  }

  if (!dispatch) {
    return { ok: false, result: fail(500, 'INTERNAL_ERROR', 'Provider dispatch is unavailable.') };
  }

  let effectiveModel = modelOverride;
  if (resolved.providerId === 'gemini') {
    try {
      effectiveModel = resolveGeminiModel(modelOverride);
    } catch (error) {
      if (error instanceof InvalidGeminiModelError) {
        return { ok: false, result: fail(400, 'INVALID_REQUEST', error.message) };
      }
      throw error;
    }
  }

  try {
    const result = await dispatch({
      providerId: resolved.providerId,
      model: effectiveModel,
      apiKey: resolved.apiKey,
      messages,
    });
    return {
      ok: true,
      execution: { content: result.content, providerId: resolved.providerId, model: effectiveModel },
    };
  } catch (error) {
    return { ok: false, result: mapProviderFailure(error) };
  }
}

/**
 * Ejecuta el chat con una credencial: preferentemente en el Core
 * (resolucion y descifrado alli), con fallback local si el Core no responde.
 */
async function executeChatWithCredential(
  request: Request,
  ownerId: string,
  credentialId: string,
  messages: Array<{ role: ProviderRole; content: string }>,
  model: string | undefined,
  deps: CredentialHandlerDeps,
  conversationId?: string,
): Promise<
  | { ok: true; response: ChatResponseLike; viaCore: boolean }
  | { ok: false; result: HandlerResult }
> {
  let effectiveModel = model;
  if (typeof model === 'string' && model.trim().length > 0) {
    try {
      effectiveModel = resolveGeminiModel(model);
    } catch (error) {
      if (error instanceof InvalidGeminiModelError) {
        return { ok: false, result: fail(400, 'INVALID_REQUEST', error.message) };
      }
      throw error;
    }
  }

  const viaCore = await tryCore(deps, (core) =>
    core.chatWithStoredCredential({ ownerId, credentialId, messages, model: effectiveModel, conversationId }),
  );
  if (viaCore) {
    if (!viaCore.ok) return { ok: false, result: viaCore.result };
    const rawPersistence = viaCore.value.persistence;
    const persistence: 'saved' | 'unavailable' | 'disabled' | undefined =
      rawPersistence === 'saved' || rawPersistence === 'unavailable' || rawPersistence === 'disabled'
        ? rawPersistence
        : undefined;

    return {
      ok: true,
      response: {
        ...viaCore.value,
        persistence,
      },
      viaCore: true,
    };
  }

  if (!deps.fallbackEnabled) {
    return {
      ok: false,
      result: fail(503, 'UNAVAILABLE', 'Dante-AI-Core no esta disponible para ejecutar el chat.'),
    };
  }

  const serviceResult = requireService(request, deps);
  if (!serviceResult.ok) return { ok: false, result: serviceResult.result };

  const run = await runWithResolvedCredential(
    ownerId,
    serviceResult.service,
    deps.dispatch,
    credentialId,
    messages,
    effectiveModel,
  );
  if (!run.ok) return { ok: false, result: run.result };

  return {
    ok: true,
    viaCore: false,
    response: {
      message: { role: 'assistant', content: run.execution.content },
      status: 'success',
      correlationId: conversationId || randomUUID(),
      providerId: run.execution.providerId,
      model: run.execution.model,
      persistence: 'disabled',
    },
  };
}

/** POST /api/chat/credentials: respuesta simple para clientes internos. */
export async function handleChatWithCredential(
  request: Request,
  deps: CredentialHandlerDeps,
): Promise<HandlerResult> {
  const owner = await requireOwner(request, deps);
  if (!owner.ok) return owner.result;

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.result;

  const clientKey = rejectClientSuppliedApiKey(parsed.body);
  if (clientKey) return clientKey;

  const rawCredentialId = typeof parsed.body.credentialId === 'string' ? parsed.body.credentialId.trim() : '';
  if (rawCredentialId.length === 0) {
    return fail(400, 'INVALID_REQUEST', 'credentialId is required.');
  }
  const credentialId = rawCredentialId;

  const messages = sanitizeMessages(parsed.body.messages);
  if (messages.length === 0) {
    return fail(400, 'INVALID_REQUEST', 'At least one valid message is required.');
  }

  const requestedModel = typeof parsed.body.model === 'string' ? parsed.body.model : undefined;
  const conversationId = extractConversationId(parsed.body);
  const executed = await executeChatWithCredential(
    request,
    owner.ownerId,
    credentialId,
    messages,
    requestedModel,
    deps,
    conversationId,
  );
  if (!executed.ok) return executed.result;

  const rawPersistence = executed.response.persistence;
  const persistence =
    rawPersistence === 'saved' || rawPersistence === 'unavailable' || rawPersistence === 'disabled'
      ? rawPersistence
      : undefined;

  return {
    status: 200,
    body: {
      content: executed.response.message.content,
      providerId: executed.response.providerId,
      model: executed.response.model,
      credentialId,
      usedCredential: true,
      resolvedBy: executed.viaCore ? 'core' : 'memory-fallback',
      ...(persistence ? { persistence } : {}),
    },
  };
}

/** POST /api/chat con credentialId: contrato ChatResponseLike para la UI. */
export async function handleChatWithStoredCredential(
  request: Request,
  deps: CredentialHandlerDeps,
): Promise<HandlerResult> {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.result;
  return handleChatWithStoredCredentialFromBody(request, parsed.body, deps);
}

export async function handleChatWithStoredCredentialFromBody(
  request: Request,
  body: Record<string, unknown>,
  deps: CredentialHandlerDeps,
): Promise<HandlerResult> {
  const owner = await requireOwner(request, deps);
  if (!owner.ok) return owner.result;

  const clientKey = rejectClientSuppliedApiKey(body);
  if (clientKey) return clientKey;

  const rawCredentialId = typeof body.credentialId === 'string' ? body.credentialId.trim() : '';
  if (rawCredentialId.length === 0) {
    return fail(400, 'INVALID_REQUEST', 'credentialId is required.');
  }
  const credentialId = rawCredentialId;

  const messages = sanitizeMessages(body.messages);
  if (messages.length === 0) {
    return fail(400, 'INVALID_REQUEST', 'At least one valid message is required.');
  }

  const requestedModel = typeof body.model === 'string' ? body.model : undefined;
  const conversationId = extractConversationId(body);
  const executed = await executeChatWithCredential(
    request,
    owner.ownerId,
    credentialId,
    messages,
    requestedModel,
    deps,
    conversationId,
  );
  if (!executed.ok) return executed.result;

  if (executed.response.message.content.trim().length === 0) {
    return fail(502, 'PROVIDER_ERROR', 'The provider returned an empty response.');
  }

  const rawPersistence = executed.response.persistence;
  const persistence =
    rawPersistence === 'saved' || rawPersistence === 'unavailable' || rawPersistence === 'disabled'
      ? rawPersistence
      : undefined;

  return {
    status: 200,
    body: {
      message: {
        role: 'assistant',
        content: executed.response.message.content,
        timestamp: new Date().toISOString(),
      },
      status: 'success',
      correlationId: executed.response.correlationId,
      providerId: executed.response.providerId,
      model: executed.response.model,
      ...(persistence ? { persistence } : {}),
    },
  };
}
