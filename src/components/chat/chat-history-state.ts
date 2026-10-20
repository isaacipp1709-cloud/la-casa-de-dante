import { z } from "zod";
import {
  DanteChatRequestSchema,
  DanteChatResponseSchema,
  DanteConversationMessagesResponseSchema,
  DanteConversationsResponseSchema,
} from "@/contracts/dante";
import { authorizedFetch } from "@/lib/auth/client-session";

type DanteChatRequest = z.infer<typeof DanteChatRequestSchema>;

export type HistoryLoadStatus =
  | "idle"
  | "loading"
  | "loaded-empty"
  | "loaded"
  | "error"
  | "unauthorized";

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  correlationId?: string;
  providerId?: string;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface SessionThread {
  /** Identificador operativo del hilo (external_id cuando existe, o id interno como respaldo explícito). */
  id: string;
  /** UUID interno de la conversación en Core (`id`). */
  internalId: string;
  /** Identificador externo (`external_id`) persistido en Core si existe. */
  externalId?: string;
  title: string;
  updatedAt?: string;
  messages: ChatMessageItem[];
  messagesStatus: HistoryLoadStatus;
  messagesLoaded: boolean;
  messagesError: string | null;
  sendError: string | null;
  persistenceWarning: string | null;
}

export interface ChatHistorySnapshot {
  authEpoch: number;
  currentOwnerId: string | null;
  conversationsStatus: HistoryLoadStatus;
  conversationsError: string | null;
  isUnauthenticated: boolean;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  sessions: SessionThread[];
  activeSessionId: string | null;
  activeSession: SessionThread | null;
}

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface ChatHistoryControllerOptions {
  fetchFn?: FetchLike;
  onChange?: (snapshot: ChatHistorySnapshot) => void;
  idGenerator?: () => string;
  messageIdGenerator?: () => string;
  nowIso?: () => string;
}

export interface SubmitMessageInput {
  text: string;
  providerId?: string;
  model?: string;
  credentialId?: string | null;
  timezone?: string;
  locale?: string;
}

export interface SubmitMessageResult {
  ok: boolean;
  threadId?: string;
}

const CHAT_ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND:
    "No tienes una clave guardada que coincida con este proveedor. Guardala y vuelve a intentarlo.",
  UNAUTHORIZED:
    "Tu sesion no esta autenticada. Inicia sesion para usar una clave guardada.",
  PROVIDER_NOT_SUPPORTED:
    "El proveedor seleccionado todavia no esta habilitado.",
  PROVIDER_UNAUTHORIZED:
    "El proveedor rechazo la clave guardada. Verificala o guardala de nuevo.",
  PROVIDER_RATE_LIMITED:
    "Se alcanzo el limite de uso del proveedor. Intentalo mas tarde.",
  PROVIDER_TIMEOUT: "El proveedor tardo demasiado en responder.",
  PROVIDER_NETWORK_ERROR: "No se pudo conectar con el proveedor.",
  PROVIDER_ERROR:
    "El proveedor devolvio un error. Intentalo nuevamente.",
  CONFIGURATION_ERROR:
    "Falta configuracion en el servidor para usar credenciales.",
  INVALID_REQUEST:
    "La solicitud no es valida. Revisa el contenido e intentalo de nuevo.",
};

export function getSafeErrorMessage(
  status: number,
  code?: string,
  serverMessage?: string,
): string {
  if (code && CHAT_ERROR_MESSAGES[code]) {
    return CHAT_ERROR_MESSAGES[code];
  }
  if (typeof serverMessage === "string" && serverMessage.trim().length > 0) {
    return serverMessage.trim();
  }
  if (status === 400) {
    return "No se pudo procesar el mensaje. Revisa el contenido e inténtalo nuevamente.";
  }
  if (status === 401) {
    return "Tu sesion no esta autenticada. Inicia sesion para usar una clave guardada.";
  }
  return "Dante no pudo responder en este momento. inténtalo nuevamente.";
}

export function generateThreadId(): string {
  if (typeof globalThis.crypto !== "undefined") {
    if (typeof globalThis.crypto.randomUUID === "function") {
      return `thread-${globalThis.crypto.randomUUID()}`;
    }
    if (typeof globalThis.crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      return `thread-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }
  throw new Error(
    "Entorno sin soporte criptográfico Web Crypto API para generar identificadores de conversación.",
  );
}

export function generateMessageId(): string {
  if (typeof globalThis.crypto !== "undefined") {
    if (typeof globalThis.crypto.randomUUID === "function") {
      return `msg-${globalThis.crypto.randomUUID()}`;
    }
    if (typeof globalThis.crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      return `msg-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }
  throw new Error(
    "Entorno sin soporte criptográfico Web Crypto API para generar identificadores de mensaje.",
  );
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

export function createChatHistoryController(
  options: ChatHistoryControllerOptions = {},
) {
  const fetchFn: FetchLike =
    options.fetchFn ?? ((input, init) => authorizedFetch(String(input), init));
  const idGenerator = options.idGenerator ?? generateThreadId;
  const messageIdGenerator = options.messageIdGenerator ?? generateMessageId;
  const nowIso = options.nowIso ?? (() => new Date().toISOString());

  let disposed = false;
  let authEpoch = 0;
  let currentOwnerId: string | null = null;

  let conversationsRequestId = 0;
  let messagesRequestId = 0;
  let sendRequestId = 0;

  let conversationsAbortController: AbortController | null = null;
  let messagesAbortController: AbortController | null = null;
  let sendAbortController: AbortController | null = null;

  let conversationsStatus: HistoryLoadStatus = "idle";
  let conversationsError: string | null = null;
  let isSending = false;
  let sessions: SessionThread[] = [];
  let activeSessionId: string | null = null;

  function buildSnapshot(): ChatHistorySnapshot {
    const activeSession = activeSessionId
      ? sessions.find((s) => s.id === activeSessionId) ?? null
      : null;
    const isUnauthenticated = conversationsStatus === "unauthorized";
    const isLoadingConversations = conversationsStatus === "loading";
    const isLoadingMessages = activeSession?.messagesStatus === "loading";

    return {
      authEpoch,
      currentOwnerId,
      conversationsStatus,
      conversationsError,
      isUnauthenticated,
      isLoadingConversations,
      isLoadingMessages: Boolean(isLoadingMessages),
      isSending,
      sessions: sessions.map((s) => ({
        ...s,
        messages: [...s.messages],
      })),
      activeSessionId,
      activeSession: activeSession
        ? {
            ...activeSession,
            messages: [...activeSession.messages],
          }
        : null,
    };
  }

  function emitChange(): void {
    if (disposed) return;
    options.onChange?.(buildSnapshot());
  }

  function updateThreadById(
    targetThreadId: string,
    updater: (thread: SessionThread) => SessionThread,
  ): boolean {
    let found = false;
    sessions = sessions.map((thread) => {
      if (thread.id !== targetThreadId && thread.internalId !== targetThreadId) {
        return thread;
      }
      found = true;
      return updater(thread);
    });
    return found;
  }

  function abortInFlightRequests(): void {
    if (conversationsAbortController) {
      conversationsAbortController.abort();
      conversationsAbortController = null;
    }
    if (messagesAbortController) {
      messagesAbortController.abort();
      messagesAbortController = null;
    }
    if (sendAbortController) {
      sendAbortController.abort();
      sendAbortController = null;
    }
    conversationsRequestId += 1;
    messagesRequestId += 1;
    sendRequestId += 1;
  }

  function transitionToUnauthorized(): void {
    authEpoch += 1;
    abortInFlightRequests();
    currentOwnerId = null;
    conversationsStatus = "unauthorized";
    conversationsError = null;
    isSending = false;
    sessions = [];
    activeSessionId = null;
    emitChange();
  }

  async function fetchMessagesForThread(
    threadId: string,
    fetchOptions?: { force?: boolean },
  ): Promise<void> {
    if (disposed) return;

    const target = sessions.find(
      (s) => s.id === threadId || s.internalId === threadId,
    );
    if (!target) return;

    const canonicalThreadId = target.id;
    if (
      !fetchOptions?.force &&
      target.messagesLoaded &&
      (target.messagesStatus === "loaded" ||
        target.messagesStatus === "loaded-empty")
    ) {
      return;
    }

    if (messagesAbortController) {
      messagesAbortController.abort();
      messagesAbortController = null;
    }

    messagesRequestId += 1;
    const requestEpoch = authEpoch;
    const requestId = messagesRequestId;
    const controller = new AbortController();
    messagesAbortController = controller;

    updateThreadById(canonicalThreadId, (thread) => ({
      ...thread,
      messagesStatus: "loading",
      messagesError: null,
    }));
    emitChange();

    try {
      const res = await fetchFn(
        `/api/conversations/${encodeURIComponent(canonicalThreadId)}/messages`,
        {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        },
      );

      if (
        disposed ||
        requestEpoch !== authEpoch ||
        requestId !== messagesRequestId ||
        controller.signal.aborted ||
        activeSessionId !== canonicalThreadId
      ) {
        return;
      }

      if (res.status === 401) {
        transitionToUnauthorized();
        return;
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const errMsg =
          errBody?.error?.message ||
          "No fue posible cargar los mensajes de esta conversación.";
        updateThreadById(canonicalThreadId, (thread) => ({
          ...thread,
          messagesStatus: "error",
          messagesLoaded: false,
          messagesError: errMsg,
        }));
        emitChange();
        return;
      }

      const rawData = await res.json();
      if (
        disposed ||
        requestEpoch !== authEpoch ||
        requestId !== messagesRequestId ||
        controller.signal.aborted ||
        activeSessionId !== canonicalThreadId
      ) {
        return;
      }

      const parsed = DanteConversationMessagesResponseSchema.safeParse(rawData);
      if (!parsed.success) {
        updateThreadById(canonicalThreadId, (thread) => ({
          ...thread,
          messagesStatus: "error",
          messagesLoaded: false,
          messagesError:
            "Respuesta de mensajes con formato o marca temporal inválida.",
        }));
        emitChange();
        return;
      }

      const loadedMessages: ChatMessageItem[] = parsed.data.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.created_at ?? m.timestamp,
      }));

      updateThreadById(canonicalThreadId, (thread) => {
        const loadedIds = new Set(loadedMessages.map((m) => m.id));
        const preservedLocal = thread.messages.filter(
          (m) => !loadedIds.has(m.id),
        );
        const mergedMessages = [...loadedMessages, ...preservedLocal];
        return {
          ...thread,
          messages: mergedMessages,
          messagesStatus:
            mergedMessages.length === 0 ? "loaded-empty" : "loaded",
          messagesLoaded: true,
          messagesError: null,
          sendError: null,
        };
      });
      emitChange();
    } catch (err) {
      if (
        disposed ||
        requestEpoch !== authEpoch ||
        requestId !== messagesRequestId ||
        controller.signal.aborted ||
        isAbortError(err) ||
        activeSessionId !== canonicalThreadId
      ) {
        return;
      }
      updateThreadById(canonicalThreadId, (thread) => ({
        ...thread,
        messagesStatus: "error",
        messagesLoaded: false,
        messagesError:
          "Error de conexión al cargar los mensajes de la conversación.",
      }));
      emitChange();
    } finally {
      if (
        !disposed &&
        requestEpoch === authEpoch &&
        requestId === messagesRequestId
      ) {
        messagesAbortController = null;
        emitChange();
      }
    }
  }

  async function loadConversations(): Promise<void> {
    if (disposed) return;

    if (conversationsAbortController) {
      conversationsAbortController.abort();
      conversationsAbortController = null;
    }

    conversationsRequestId += 1;
    const requestEpoch = authEpoch;
    const requestId = conversationsRequestId;
    const controller = new AbortController();
    conversationsAbortController = controller;

    conversationsStatus = "loading";
    conversationsError = null;
    emitChange();

    try {
      const res = await fetchFn("/api/conversations", {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      if (
        disposed ||
        requestEpoch !== authEpoch ||
        requestId !== conversationsRequestId ||
        controller.signal.aborted
      ) {
        return;
      }

      if (res.status === 401) {
        transitionToUnauthorized();
        return;
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        conversationsStatus = "error";
        conversationsError =
          errBody?.error?.message ||
          "No fue posible recuperar el historial de conversaciones.";
        emitChange();
        return;
      }

      const rawData = await res.json();
      if (
        disposed ||
        requestEpoch !== authEpoch ||
        requestId !== conversationsRequestId ||
        controller.signal.aborted
      ) {
        return;
      }

      const parsed = DanteConversationsResponseSchema.safeParse(rawData);
      if (!parsed.success) {
        conversationsStatus = "error";
        conversationsError =
          "Respuesta de conversaciones con formato o marca temporal inválida.";
        emitChange();
        return;
      }

      const existingById = new Map<string, SessionThread>();
      for (const existing of sessions) {
        existingById.set(existing.id, existing);
        existingById.set(existing.internalId, existing);
      }

      const remoteLoaded: SessionThread[] = parsed.data.map((c) => {
        const internalId = c.id.trim();
        const externalId =
          typeof c.external_id === "string" && c.external_id.trim().length > 0
            ? c.external_id.trim()
            : undefined;
        const threadId = externalId ?? internalId;
        const title =
          typeof c.title === "string" && c.title.trim().length > 0
            ? c.title.trim()
            : externalId && externalId !== internalId
              ? externalId
              : `Conversación ${internalId.slice(0, 8)}`;

        const prev =
          existingById.get(threadId) ?? existingById.get(internalId);
        if (prev) {
          return {
            ...prev,
            id: threadId,
            internalId,
            externalId,
            title: prev.title !== "Nueva conversación" ? prev.title : title,
            updatedAt: c.updated_at,
          };
        }

        return {
          id: threadId,
          internalId,
          externalId,
          title,
          updatedAt: c.updated_at,
          messages: [],
          messagesStatus: "idle",
          messagesLoaded: false,
          messagesError: null,
          sendError: null,
          persistenceWarning: null,
        };
      });

      const remoteIds = new Set<string>();
      for (const item of remoteLoaded) {
        remoteIds.add(item.id);
        remoteIds.add(item.internalId);
      }

      const localOnly = sessions.filter(
        (s) => !remoteIds.has(s.id) && !remoteIds.has(s.internalId),
      );
      const mergedSessions = [...localOnly, ...remoteLoaded];

      sessions = mergedSessions;
      conversationsStatus =
        mergedSessions.length === 0 ? "loaded-empty" : "loaded";
      conversationsError = null;

      let threadToAutoFetch: string | null = null;
      if (!activeSessionId && mergedSessions.length > 0) {
        activeSessionId = mergedSessions[0].id;
        if (!mergedSessions[0].messagesLoaded) {
          threadToAutoFetch = mergedSessions[0].id;
        }
      } else if (activeSessionId) {
        const activeThread = mergedSessions.find(
          (s) => s.id === activeSessionId,
        );
        if (
          activeThread &&
          !activeThread.messagesLoaded &&
          activeThread.messagesStatus === "idle"
        ) {
          threadToAutoFetch = activeThread.id;
        }
      }

      emitChange();

      if (threadToAutoFetch) {
        await fetchMessagesForThread(threadToAutoFetch);
      }
    } catch (err) {
      if (
        disposed ||
        requestEpoch !== authEpoch ||
        requestId !== conversationsRequestId ||
        controller.signal.aborted ||
        isAbortError(err)
      ) {
        return;
      }
      conversationsStatus = "error";
      conversationsError =
        "Error de conexión al recuperar el historial de conversaciones.";
      emitChange();
    } finally {
      if (
        !disposed &&
        requestEpoch === authEpoch &&
        requestId === conversationsRequestId
      ) {
        conversationsAbortController = null;
        emitChange();
      }
    }
  }

  async function selectSession(threadId: string): Promise<void> {
    if (disposed) return;
    const target = sessions.find(
      (s) => s.id === threadId || s.internalId === threadId,
    );
    if (!target) return;

    const canonicalId = target.id;
    if (activeSessionId !== canonicalId) {
      if (messagesAbortController) {
        messagesAbortController.abort();
        messagesAbortController = null;
      }
      messagesRequestId += 1;

      sessions = sessions.map((s): SessionThread =>
        s.messagesStatus === "loading" && !s.messagesLoaded
          ? { ...s, messagesStatus: "idle" }
          : s,
      );
      activeSessionId = canonicalId;
      emitChange();
    }

    const updatedTarget = sessions.find((s) => s.id === canonicalId);
    if (updatedTarget && !updatedTarget.messagesLoaded) {
      await fetchMessagesForThread(canonicalId);
    }
  }

  function createNewSession(): SessionThread {
    if (messagesAbortController) {
      messagesAbortController.abort();
      messagesAbortController = null;
    }
    messagesRequestId += 1;

    const newId = idGenerator();
    const newThread: SessionThread = {
      id: newId,
      internalId: newId,
      externalId: newId,
      title: "Nueva conversación",
      updatedAt: nowIso(),
      messages: [],
      messagesStatus: "loaded-empty",
      messagesLoaded: true,
      messagesError: null,
      sendError: null,
      persistenceWarning: null,
    };

    sessions = [
      newThread,
      ...sessions.map((s): SessionThread =>
        s.messagesStatus === "loading" && !s.messagesLoaded
          ? { ...s, messagesStatus: "idle" }
          : s,
      ),
    ];
    activeSessionId = newId;
    if (
      conversationsStatus === "loaded-empty" ||
      conversationsStatus === "idle"
    ) {
      conversationsStatus = "loaded";
    }
    emitChange();
    return newThread;
  }

  function clearCurrentMessages(): void {
    if (!activeSessionId) return;
    updateThreadById(activeSessionId, (thread) => ({
      ...thread,
      messages: [],
      messagesStatus: "loaded-empty",
      messagesLoaded: true,
      messagesError: null,
      sendError: null,
      persistenceWarning: null,
    }));
    emitChange();
  }

  async function submitMessage(
    input: SubmitMessageInput,
  ): Promise<SubmitMessageResult> {
    if (disposed) return { ok: false };
    const trimmed = input.text.trim();
    if (!trimmed || isSending) return { ok: false };

    const shortTitle =
      trimmed.length > 36 ? `${trimmed.slice(0, 36)}…` : trimmed;

    // 1. Determinar el hilo objetivo actual si existe
    let targetThread = activeSessionId
      ? sessions.find((s) => s.id === activeSessionId) ?? null
      : null;

    // 2. Para un hilo remoto existente: bloquear envío si sus mensajes están pendientes de carga, cargándose o en error,
    // ANTES de añadir cualquier mensaje al hilo o invocar /api/chat.
    if (
      targetThread &&
      (!targetThread.messagesLoaded ||
        targetThread.messagesStatus === "idle" ||
        targetThread.messagesStatus === "loading" ||
        targetThread.messagesStatus === "error")
    ) {
      const blockedThreadId = targetThread.id;
      const reason =
        targetThread.messagesStatus === "loading"
          ? "Los mensajes de esta conversación se están cargando. Espera a que finalice la carga antes de enviar."
          : targetThread.messagesStatus === "error"
            ? "No se puede enviar mientras la carga del historial esté en error. Reintenta cargar los mensajes primero."
            : "Los mensajes de esta conversación están pendientes de carga. Carga el historial antes de enviar.";

      updateThreadById(blockedThreadId, (thread) => ({
        ...thread,
        sendError: reason,
      }));
      emitChange();
      return { ok: false, threadId: blockedThreadId };
    }

    if (!targetThread) {
      const newId = idGenerator();
      targetThread = {
        id: newId,
        internalId: newId,
        externalId: newId,
        title: shortTitle,
        updatedAt: nowIso(),
        messages: [],
        messagesStatus: "loaded",
        messagesLoaded: true,
        messagesError: null,
        sendError: null,
        persistenceWarning: null,
      };
      sessions = [targetThread, ...sessions];
      activeSessionId = newId;
      if (
        conversationsStatus === "loaded-empty" ||
        conversationsStatus === "idle"
      ) {
        conversationsStatus = "loaded";
      }
    }

    const targetThreadId = targetThread.id;

    const timestampNow = nowIso();
    const userMessage: ChatMessageItem = {
      id: messageIdGenerator(),
      role: "user",
      content: trimmed,
      providerId: input.providerId,
      model: input.model,
      timestamp: timestampNow,
    };

    const previousValidHistory = targetThread.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }));

    const nextMessages = [...targetThread.messages, userMessage];

    // 3. Actualizar explícitamente el hilo objetivo por su targetThreadId (sin depender del closure del render)
    updateThreadById(targetThreadId, (thread) => ({
      ...thread,
      title:
        thread.messages.filter((m) => m.role === "user").length === 0 &&
        thread.title === "Nueva conversación"
          ? shortTitle
          : thread.title,
      updatedAt: timestampNow,
      messages: nextMessages,
      messagesStatus: "loaded",
      messagesLoaded: true,
      messagesError: null,
      sendError: null,
      persistenceWarning: null,
    }));

    if (sendAbortController) {
      sendAbortController.abort();
      sendAbortController = null;
    }

    sendRequestId += 1;
    const requestEpoch = authEpoch;
    const requestId = sendRequestId;
    const controller = new AbortController();
    sendAbortController = controller;
    isSending = true;
    emitChange();

    try {
      const requestPayload: DanteChatRequest = {
        providerId: input.providerId,
        model: input.model,
        credentialId: input.credentialId ?? undefined,
        sessionId: targetThreadId,
        conversationId: targetThreadId,
        messages: [
          ...previousValidHistory,
          { role: "user", content: trimmed, timestamp: timestampNow },
        ],
        ...(input.timezone || input.locale
          ? {
              context: {
                timezone: input.timezone || "America/Santiago",
                locale: input.locale || "es-CL",
              },
            }
          : {}),
      };

      const res = await fetchFn("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      if (
        disposed ||
        requestEpoch !== authEpoch ||
        requestId !== sendRequestId ||
        controller.signal.aborted
      ) {
        return { ok: false, threadId: targetThreadId };
      }

      if (res.status === 401) {
        transitionToUnauthorized();
        return { ok: false, threadId: targetThreadId };
      }

      const data = await res.json().catch(() => null);
      if (
        disposed ||
        requestEpoch !== authEpoch ||
        requestId !== sendRequestId ||
        controller.signal.aborted
      ) {
        return { ok: false, threadId: targetThreadId };
      }

      if (!res.ok) {
        const errorCode = data?.error?.code as string | undefined;
        const serverMsg = data?.error?.message as string | undefined;
        const errMsg = getSafeErrorMessage(res.status, errorCode, serverMsg);
        updateThreadById(targetThreadId, (thread) => ({
          ...thread,
          sendError: errMsg,
        }));
        emitChange();
        return { ok: false, threadId: targetThreadId };
      }

      const parsed = DanteChatResponseSchema.safeParse(data);
      if (!parsed.success || parsed.data.status === "error") {
        updateThreadById(targetThreadId, (thread) => ({
          ...thread,
          sendError:
            "La respuesta del servidor no cumplió el contrato DanteChatResponseSchema.",
        }));
        emitChange();
        return { ok: false, threadId: targetThreadId };
      }

      const validData = parsed.data;
      const assistantTimestamp = validData.message.timestamp ?? nowIso();
      const assistantMessage: ChatMessageItem = {
        id: messageIdGenerator(),
        role: validData.message.role,
        content: validData.message.content,
        timestamp: assistantTimestamp,
        correlationId: validData.correlationId,
        providerId: validData.providerId,
        model: validData.model,
        usage: validData.usage,
      };

      const persistenceWarning =
        validData.persistence === "unavailable"
          ? "La respuesta se generó, pero no se pudo guardar la conversación en el servidor."
          : null;

      updateThreadById(targetThreadId, (thread) => ({
        ...thread,
        updatedAt: assistantTimestamp,
        messages: [...thread.messages, assistantMessage],
        messagesStatus: "loaded",
        messagesLoaded: true,
        sendError: null,
        persistenceWarning,
      }));
      emitChange();
      return { ok: true, threadId: targetThreadId };
    } catch (err) {
      if (
        disposed ||
        requestEpoch !== authEpoch ||
        requestId !== sendRequestId ||
        controller.signal.aborted ||
        isAbortError(err)
      ) {
        return { ok: false, threadId: targetThreadId };
      }
      const message =
        err instanceof Error
          ? err.message
          : "Error de red al comunicarse con /api/chat";
      updateThreadById(targetThreadId, (thread) => ({
        ...thread,
        sendError: message,
      }));
      emitChange();
      return { ok: false, threadId: targetThreadId };
    } finally {
      if (
        !disposed &&
        requestEpoch === authEpoch &&
        requestId === sendRequestId
      ) {
        isSending = false;
        sendAbortController = null;
        emitChange();
      }
    }
  }

  function handleAuthStateChange(
    event: string,
    nextOwnerId?: string | null,
  ): void {
    if (disposed) return;

    if (event === "SIGNED_OUT") {
      transitionToUnauthorized();
      return;
    }

    if (
      event === "SIGNED_IN" ||
      event === "TOKEN_REFRESHED" ||
      event === "INITIAL_SESSION" ||
      event === "USER_UPDATED"
    ) {
      const normalizedNextOwner =
        typeof nextOwnerId === "string" && nextOwnerId.trim().length > 0
          ? nextOwnerId.trim()
          : null;

      const ownerChanged =
        normalizedNextOwner !== null &&
        currentOwnerId !== null &&
        normalizedNextOwner !== currentOwnerId;

      const wasUnauthorized = conversationsStatus === "unauthorized";

      if (ownerChanged || wasUnauthorized) {
        authEpoch += 1;
        abortInFlightRequests();
        currentOwnerId = normalizedNextOwner;
        conversationsStatus = "idle";
        conversationsError = null;
        isSending = false;
        sessions = [];
        activeSessionId = null;
        emitChange();

        const scheduledEpoch = authEpoch;
        setTimeout(() => {
          if (!disposed && authEpoch === scheduledEpoch) {
            void loadConversations();
          }
        }, 0);
        return;
      }

      if (currentOwnerId === null && normalizedNextOwner !== null) {
        currentOwnerId = normalizedNextOwner;
      }

      if (conversationsStatus === "idle") {
        const scheduledEpoch = authEpoch;
        setTimeout(() => {
          if (
            !disposed &&
            authEpoch === scheduledEpoch &&
            conversationsStatus === "idle"
          ) {
            void loadConversations();
          }
        }, 0);
      }
    }
  }

  async function retryLoadConversations(): Promise<void> {
    await loadConversations();
  }

  async function retryLoadMessages(threadId?: string): Promise<void> {
    const targetId = threadId ?? activeSessionId;
    if (!targetId) return;
    await fetchMessagesForThread(targetId, { force: true });
  }

  function clearActiveThreadErrors(): void {
    if (!activeSessionId) return;
    updateThreadById(activeSessionId, (thread) => ({
      ...thread,
      sendError: null,
      persistenceWarning: null,
    }));
    emitChange();
  }

  function dispose(): void {
    disposed = true;
    authEpoch += 1;
    abortInFlightRequests();
  }

  return {
    getSnapshot: buildSnapshot,
    loadConversations,
    retryLoadConversations,
    fetchMessagesForThread,
    retryLoadMessages,
    selectSession,
    createNewSession,
    clearCurrentMessages,
    submitMessage,
    handleAuthStateChange,
    clearActiveThreadErrors,
    dispose,
  };
}
