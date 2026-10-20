import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { GET as getConversationsRoute } from "../src/app/api/conversations/route";
import { GET as getConversationMessagesRoute } from "../src/app/api/conversations/[id]/messages/route";
import { POST as postChatRoute } from "../src/app/api/chat/route";
import {
  DanteConversationMessageSchema,
  DanteConversationMessagesResponseSchema,
  DanteConversationSchema,
  DanteConversationsResponseSchema,
  DanteTimestampSchema,
} from "../src/contracts/dante";
import { OWNER_ASSERTION_HEADER } from "../src/lib/credentials/owner-assertion";
import {
  createChatHistoryController,
  generateMessageId,
  generateThreadId,
  type FetchLike,
} from "../src/components/chat/chat-history-state";

const TEST_OWNER_ID = "owner-uuid-real-history-test";
const TEST_CORE_TOKEN = "test-core-token-real-history-32-bytes";
const TEST_SUPABASE_URL = "https://example.supabase.co";
const TEST_SUPABASE_ANON_KEY = "test-anon-key-history";

interface DeferredResponse {
  promise: Promise<Response>;
  resolve: (res: Response) => void;
  reject: (err: unknown) => void;
}

function createDeferredResponse(): DeferredResponse {
  let resolve!: (res: Response) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createAuthorizedRequest(
  url: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      Authorization: "Bearer valid-supabase-jwt-token",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("Fase B — Historial Real, Concurrencia y Contratos (Comportamiento Real)", () => {
  const originalFetch = global.fetch;
  const envKeys = [
    "DANTE_CORE_TOKEN",
    "DANTE_BRIDGE_MODE",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "DANTE_AUTHORIZED_OWNER_IDS",
    "DANTE_ALLOW_DEV_FALLBACK_OWNER",
  ] as const;

  const savedEnv: Record<string, string | undefined> = {};
  const hadEnv: Record<string, boolean> = {};

  function setupTestEnv() {
    for (const key of envKeys) {
      hadEnv[key] = key in process.env;
      savedEnv[key] = process.env[key];
    }
    process.env.DANTE_CORE_TOKEN = TEST_CORE_TOKEN;
    process.env.DANTE_BRIDGE_MODE = "core";
    process.env.NEXT_PUBLIC_SUPABASE_URL = TEST_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = TEST_SUPABASE_ANON_KEY;
    process.env.DANTE_AUTHORIZED_OWNER_IDS = TEST_OWNER_ID;
    delete process.env.DANTE_ALLOW_DEV_FALLBACK_OWNER;
  }

  function restoreTestEnv() {
    for (const key of envKeys) {
      if (hadEnv[key]) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
    if (typeof originalFetch === "function") {
      global.fetch = originalFetch;
    } else {
      delete (global as unknown as Record<string, unknown>).fetch;
    }
  }

  it("1. Lista vacía → primer envío: crea un único hilo, envía ese ID en sessionId/conversationId y conserva usuario + asistente en ese hilo", async () => {
    const capturedChatPayloads: Array<Record<string, unknown>> = [];

    const transport: FetchLike = async (input, init) => {
      const url = String(input);
      if (url === "/api/conversations") {
        return jsonResponse([], 200);
      }
      if (url === "/api/chat") {
        const body = JSON.parse(String(init?.body ?? "{}"));
        capturedChatPayloads.push(body);
        return jsonResponse(
          {
            message: {
              role: "assistant",
              content: "Respuesta al primer turno desde lista vacía",
              timestamp: "2026-10-18T12:00:01.000Z",
            },
            status: "success",
            correlationId: String(body.conversationId),
            providerId: "gemini",
            model: "gemini-3.8-flash",
            persistence: "saved",
          },
          200,
        );
      }
      return jsonResponse({ error: { message: "Not found" } }, 404);
    };

    const controller = createChatHistoryController({
      fetchFn: transport,
      nowIso: () => "2026-10-18T12:00:00.000Z",
    });

    try {
      await controller.loadConversations();
      const afterLoad = controller.getSnapshot();
      assert.equal(afterLoad.conversationsStatus, "loaded-empty");
      assert.equal(afterLoad.sessions.length, 0);
      assert.equal(afterLoad.activeSessionId, null);

      const sendResult = await controller.submitMessage({
        text: "Hola Dante, primer envío sin conversaciones previas",
        credentialId: "cred-byok-1",
      });

      assert.equal(sendResult.ok, true);
      const snap = controller.getSnapshot();
      assert.equal(snap.sessions.length, 1, "Debe existir exactamente un hilo creado");

      const createdThread = snap.sessions[0];
      assert.ok(createdThread.id.startsWith("thread-"), "El ID del hilo debe ser generado criptográficamente");
      assert.notEqual(createdThread.id, "nueva-conversacion", "Nunca debe enviarse ni usarse el placeholder nueva-conversacion");
      assert.equal(snap.activeSessionId, createdThread.id);
      assert.equal(sendResult.threadId, createdThread.id);

      assert.equal(capturedChatPayloads.length, 1);
      assert.equal(capturedChatPayloads[0].sessionId, createdThread.id);
      assert.equal(capturedChatPayloads[0].conversationId, createdThread.id);

      assert.equal(createdThread.messages.length, 2, "El hilo creado debe conservar tanto el mensaje del usuario como la respuesta del asistente");
      assert.equal(createdThread.messages[0].role, "user");
      assert.equal(createdThread.messages[0].content, "Hola Dante, primer envío sin conversaciones previas");
      assert.equal(createdThread.messages[1].role, "assistant");
      assert.equal(createdThread.messages[1].content, "Respuesta al primer turno desde lista vacía");
    } finally {
      controller.dispose();
    }
  });

  it("2. Segundo turno en la misma conversación: reutiliza el mismo conversationId/sessionId y mantiene ambos turnos", async () => {
    const capturedChatPayloads: Array<Record<string, unknown>> = [];
    let turn = 0;

    const transport: FetchLike = async (input, init) => {
      const url = String(input);
      if (url === "/api/conversations") {
        return jsonResponse([], 200);
      }
      if (url === "/api/chat") {
        turn += 1;
        const body = JSON.parse(String(init?.body ?? "{}"));
        capturedChatPayloads.push(body);
        return jsonResponse(
          {
            message: {
              role: "assistant",
              content: `Respuesta turno ${turn}`,
              timestamp: `2026-10-18T12:00:0${turn}.000Z`,
            },
            status: "success",
            correlationId: `${body.conversationId}-t${turn}`,
            providerId: "gemini",
            persistence: "saved",
          },
          200,
        );
      }
      return jsonResponse({}, 404);
    };

    const controller = createChatHistoryController({ fetchFn: transport });

    try {
      await controller.loadConversations();

      const res1 = await controller.submitMessage({
        text: "Turno 1: analiza IVA",
        credentialId: "cred-1",
      });
      const res2 = await controller.submitMessage({
        text: "Turno 2: agrega flujo de caja",
        credentialId: "cred-1",
      });

      assert.equal(res1.ok, true);
      assert.equal(res2.ok, true);
      assert.equal(res1.threadId, res2.threadId, "El segundo turno debe usar exactamente el mismo hilo");

      assert.equal(capturedChatPayloads.length, 2);
      assert.equal(capturedChatPayloads[0].conversationId, res1.threadId);
      assert.equal(capturedChatPayloads[1].conversationId, res1.threadId);
      assert.equal(capturedChatPayloads[0].sessionId, res1.threadId);
      assert.equal(capturedChatPayloads[1].sessionId, res1.threadId);

      const sentMessagesTurn2 = capturedChatPayloads[1].messages as Array<{ role: string; content: string }>;
      assert.equal(sentMessagesTurn2.length, 3, "El segundo turno debe enviar el contexto acumulado (user1, assistant1, user2)");

      const snap = controller.getSnapshot();
      assert.equal(snap.sessions.length, 1);
      assert.equal(snap.activeSession?.messages.length, 4);
      assert.deepEqual(
        snap.activeSession?.messages.map((m) => m.content),
        [
          "Turno 1: analiza IVA",
          "Respuesta turno 1",
          "Turno 2: agrega flujo de caja",
          "Respuesta turno 2",
        ],
      );
    } finally {
      controller.dispose();
    }
  });

  it("3. Dos conversaciones distintas: cambiar entre ambas mantiene mensajes e identificadores separados", async () => {
    const capturedChatPayloads: Array<Record<string, unknown>> = [];

    const transport: FetchLike = async (input, init) => {
      const url = String(input);
      if (url === "/api/conversations") {
        return jsonResponse(
          [
            {
              id: "uuid-conv-a",
              external_id: "thread-alpha",
              title: "Conversación Alpha",
              updated_at: "2026-10-18T10:00:00.000Z",
            },
            {
              id: "uuid-conv-b",
              external_id: "thread-beta",
              title: "Conversación Beta",
              updated_at: "2026-10-18T09:00:00.000Z",
            },
          ],
          200,
        );
      }
      if (url === "/api/conversations/thread-alpha/messages") {
        return jsonResponse(
          [
            {
              id: "m-a1",
              role: "user",
              content: "Mensaje histórico Alpha",
              created_at: "2026-10-18T10:00:00.000Z",
            },
          ],
          200,
        );
      }
      if (url === "/api/conversations/thread-beta/messages") {
        return jsonResponse(
          [
            {
              id: "m-b1",
              role: "user",
              content: "Mensaje histórico Beta",
              created_at: "2026-10-18T09:00:00.000Z",
            },
          ],
          200,
        );
      }
      if (url === "/api/chat") {
        const body = JSON.parse(String(init?.body ?? "{}"));
        capturedChatPayloads.push(body);
        return jsonResponse(
          {
            message: {
              role: "assistant",
              content: `Respuesta para ${body.conversationId}`,
              timestamp: "2026-10-18T11:00:00.000Z",
            },
            status: "success",
            correlationId: `corr-${body.conversationId}`,
            persistence: "saved",
          },
          200,
        );
      }
      return jsonResponse({}, 404);
    };

    const controller = createChatHistoryController({ fetchFn: transport });

    try {
      await controller.loadConversations();
      assert.equal(controller.getSnapshot().activeSessionId, "thread-alpha");
      assert.equal(controller.getSnapshot().activeSession?.messages[0]?.content, "Mensaje histórico Alpha");

      await controller.selectSession("thread-beta");
      assert.equal(controller.getSnapshot().activeSessionId, "thread-beta");
      assert.equal(controller.getSnapshot().activeSession?.messages[0]?.content, "Mensaje histórico Beta");

      await controller.submitMessage({
        text: "Nuevo turno en Beta",
        credentialId: "cred-1",
      });

      await controller.selectSession("thread-alpha");
      await controller.submitMessage({
        text: "Nuevo turno en Alpha",
        credentialId: "cred-1",
      });

      assert.equal(capturedChatPayloads.length, 2);
      assert.equal(capturedChatPayloads[0].conversationId, "thread-beta");
      assert.equal(capturedChatPayloads[1].conversationId, "thread-alpha");

      const snap = controller.getSnapshot();
      const alpha = snap.sessions.find((s) => s.id === "thread-alpha")!;
      const beta = snap.sessions.find((s) => s.id === "thread-beta")!;

      assert.deepEqual(
        alpha.messages.map((m) => m.content),
        ["Mensaje histórico Alpha", "Nuevo turno en Alpha", "Respuesta para thread-alpha"],
      );
      assert.deepEqual(
        beta.messages.map((m) => m.content),
        ["Mensaje histórico Beta", "Nuevo turno en Beta", "Respuesta para thread-beta"],
      );
    } finally {
      controller.dispose();
    }
  });

  it("4. Solicitud de listado pendiente → cierre de sesión (SIGNED_OUT) → resolución tardía no repuebla conversaciones", async () => {
    const deferredConversations = createDeferredResponse();

    const transport: FetchLike = async (input) => {
      const url = String(input);
      if (url === "/api/conversations") {
        return deferredConversations.promise;
      }
      return jsonResponse([], 200);
    };

    const controller = createChatHistoryController({ fetchFn: transport });

    try {
      const loadPromise = controller.loadConversations();
      assert.equal(controller.getSnapshot().isLoadingConversations, true);

      // Ocurre SIGNED_OUT antes de que resuelva el listado
      controller.handleAuthStateChange("SIGNED_OUT", null);

      const afterSignOut = controller.getSnapshot();
      assert.equal(afterSignOut.isUnauthenticated, true);
      assert.equal(afterSignOut.conversationsStatus, "unauthorized");
      assert.equal(afterSignOut.isLoadingConversations, false);
      assert.equal(afterSignOut.sessions.length, 0);

      // La promesa pendiente resuelve tardíamente con datos del usuario anterior
      deferredConversations.resolve(
        jsonResponse(
          [
            {
              id: "uuid-stale-1",
              external_id: "stale-thread-1",
              title: "Conversación que no debe aparecer",
              updated_at: "2026-10-18T10:00:00.000Z",
            },
          ],
          200,
        ),
      );
      await loadPromise;

      const finalSnap = controller.getSnapshot();
      assert.equal(finalSnap.sessions.length, 0, "La respuesta tardía tras SIGNED_OUT jamás debe repoblar sesiones");
      assert.equal(finalSnap.activeSessionId, null);
      assert.equal(finalSnap.conversationsStatus, "unauthorized");
      assert.equal(finalSnap.isUnauthenticated, true);
    } finally {
      controller.dispose();
    }
  });

  it("5. Solicitud de usuario A → cambio a usuario B: respuestas tardías de A no contaminan el estado de B", async () => {
    const deferredUserAConversations = createDeferredResponse();
    const deferredUserAChat = createDeferredResponse();
    let activeTransportUser: "user-A" | "user-B" = "user-A";

    const transport: FetchLike = async (input) => {
      const url = String(input);
      if (url === "/api/conversations") {
        if (activeTransportUser === "user-A") {
          return deferredUserAConversations.promise;
        }
        return jsonResponse(
          [
            {
              id: "uuid-b-1",
              external_id: "thread-user-b",
              title: "Conversación Exclusiva de Usuario B",
              updated_at: "2026-10-18T11:00:00.000Z",
            },
          ],
          200,
        );
      }
      if (url === "/api/conversations/thread-user-b/messages") {
        return jsonResponse(
          [
            {
              id: "msg-b-1",
              role: "user",
              content: "Mensaje privado de B",
              created_at: "2026-10-18T11:00:00.000Z",
            },
          ],
          200,
        );
      }
      if (url === "/api/chat") {
        return deferredUserAChat.promise;
      }
      return jsonResponse([], 200);
    };

    const controller = createChatHistoryController({ fetchFn: transport });

    try {
      // Inicia sesión Usuario A y dispara carga + envío
      controller.handleAuthStateChange("INITIAL_SESSION", "user-A");
      const pendingLoadA = controller.loadConversations();
      const pendingChatA = controller.submitMessage({
        text: "Consulta secreta de Usuario A",
        credentialId: "cred-A",
      });

      // Cambia la sesión activa a Usuario B antes de que respondan las solicitudes de A
      activeTransportUser = "user-B";
      controller.handleAuthStateChange("SIGNED_IN", "user-B");

      // Esperar al siguiente tick donde se agenda la recarga segura de B
      await new Promise((resolve) => setTimeout(resolve, 15));

      // Ahora resuelven tardíamente tanto el listado como el chat de A
      deferredUserAConversations.resolve(
        jsonResponse(
          [
            {
              id: "uuid-a-1",
              external_id: "thread-user-a",
              title: "Conversación Privada de Usuario A",
              updated_at: "2026-10-18T10:00:00.000Z",
            },
          ],
          200,
        ),
      );
      deferredUserAChat.resolve(
        jsonResponse(
          {
            message: {
              role: "assistant",
              content: "Respuesta tardía para Usuario A",
              timestamp: "2026-10-18T10:05:00.000Z",
            },
            status: "success",
            correlationId: "corr-user-a",
            persistence: "saved",
          },
          200,
        ),
      );

      await Promise.all([pendingLoadA, pendingChatA]);

      const snap = controller.getSnapshot();
      assert.equal(snap.currentOwnerId, "user-B");
      assert.equal(snap.sessions.length, 1, "Solo debe existir la conversación de Usuario B");
      assert.equal(snap.sessions[0].id, "thread-user-b");
      assert.equal(
        snap.sessions.some((s) => s.id === "thread-user-a" || s.title.includes("Usuario A")),
        false,
        "Ningún dato de Usuario A puede contaminar la sesión de Usuario B",
      );
      assert.deepEqual(
        snap.activeSession?.messages.map((m) => m.content),
        ["Mensaje privado de B"],
      );
    } finally {
      controller.dispose();
    }
  });

  it("6. Cambio rápido Conversación 1 → Conversación 2: respuesta tardía de Conv 1 no pisa mensajes ni apaga carga de Conv 2", async () => {
    const deferredConv1Messages = createDeferredResponse();
    const deferredConv2Messages = createDeferredResponse();

    const transport: FetchLike = async (input) => {
      const url = String(input);
      if (url === "/api/conversations") {
        return jsonResponse(
          [
            {
              id: "uuid-1",
              external_id: "conv-1",
              title: "Conversación 1",
              updated_at: "2026-10-18T10:00:00.000Z",
            },
            {
              id: "uuid-2",
              external_id: "conv-2",
              title: "Conversación 2",
              updated_at: "2026-10-18T09:00:00.000Z",
            },
          ],
          200,
        );
      }
      if (url === "/api/conversations/conv-1/messages") {
        return deferredConv1Messages.promise;
      }
      if (url === "/api/conversations/conv-2/messages") {
        return deferredConv2Messages.promise;
      }
      return jsonResponse([], 200);
    };

    const controller = createChatHistoryController({ fetchFn: transport });

    try {
      // loadConversations inicia automáticamente la carga de conv-1
      const loadConvPromise = controller.loadConversations();
      await new Promise((resolve) => setTimeout(resolve, 5));

      assert.equal(controller.getSnapshot().activeSessionId, "conv-1");
      assert.equal(controller.getSnapshot().isLoadingMessages, true);

      // El usuario cambia rápidamente a conv-2 mientras conv-1 sigue en vuelo
      const selectConv2Promise = controller.selectSession("conv-2");
      await new Promise((resolve) => setTimeout(resolve, 5));

      assert.equal(controller.getSnapshot().activeSessionId, "conv-2");
      assert.equal(controller.getSnapshot().isLoadingMessages, true, "Conv 2 debe estar en estado de carga");

      // Conv 1 resuelve tardíamente ANTES de que termine Conv 2
      deferredConv1Messages.resolve(
        jsonResponse(
          [
            {
              id: "m-conv1",
              role: "user",
              content: "Mensaje tardío de Conv 1",
              created_at: "2026-10-18T10:00:00.000Z",
            },
          ],
          200,
        ),
      );
      await loadConvPromise;

      // El finally de Conv 1 NO debe haber apagado el indicador de carga de Conv 2 ni mezclado mensajes
      const midSnap = controller.getSnapshot();
      assert.equal(midSnap.activeSessionId, "conv-2");
      assert.equal(
        midSnap.isLoadingMessages,
        true,
        "La finalización tardía de Conv 1 NO debe apagar el indicador de carga de Conv 2",
      );
      assert.equal(midSnap.activeSession?.messages.length, 0);

      // Ahora resuelve Conv 2
      deferredConv2Messages.resolve(
        jsonResponse(
          [
            {
              id: "m-conv2",
              role: "assistant",
              content: "Mensaje legítimo de Conv 2",
              created_at: "2026-10-18T09:05:00.000Z",
            },
          ],
          200,
        ),
      );
      await selectConv2Promise;

      const finalSnap = controller.getSnapshot();
      assert.equal(finalSnap.activeSessionId, "conv-2");
      assert.equal(finalSnap.isLoadingMessages, false);
      assert.equal(finalSnap.activeSession?.messagesStatus, "loaded");
      assert.deepEqual(
        finalSnap.activeSession?.messages.map((m) => m.content),
        ["Mensaje legítimo de Conv 2"],
      );

      // Además, Conv 1 no debe haber quedado marcada como loaded por una respuesta abortada
      const conv1State = finalSnap.sessions.find((s) => s.id === "conv-1")!;
      assert.equal(conv1State.messagesLoaded, false);
    } finally {
      controller.dispose();
    }
  });

  it("7. Error de carga → reintento: fallo de mensajes o listado no marca loaded ni inyecta mensajes falsos, y recupera al reintentar", async () => {
    let listAttempts = 0;
    let msgAttempts = 0;

    const transport: FetchLike = async (input) => {
      const url = String(input);
      if (url === "/api/conversations") {
        listAttempts += 1;
        if (listAttempts === 1) {
          return jsonResponse(
            { error: { code: "STORAGE_ERROR", message: "Fallo temporal en listado" } },
            503,
          );
        }
        return jsonResponse(
          [
            {
              id: "uuid-retry-1",
              external_id: "thread-retry-1",
              title: "Hilo con Reintento",
              updated_at: "2026-10-18T10:00:00.000Z",
            },
          ],
          200,
        );
      }
      if (url === "/api/conversations/thread-retry-1/messages") {
        msgAttempts += 1;
        if (msgAttempts === 1) {
          return jsonResponse(
            { error: { code: "STORAGE_ERROR", message: "Fallo temporal al leer mensajes" } },
            503,
          );
        }
        return jsonResponse(
          [
            {
              id: "msg-ok-1",
              role: "user",
              content: "Mensaje recuperado tras reintento",
              created_at: "2026-10-18T10:01:00.000Z",
            },
          ],
          200,
        );
      }
      return jsonResponse({}, 404);
    };

    const controller = createChatHistoryController({ fetchFn: transport });

    try {
      // Intento 1 de listado falla con 503
      await controller.loadConversations();
      const afterListError = controller.getSnapshot();
      assert.equal(afterListError.conversationsStatus, "error");
      assert.equal(afterListError.conversationsError, "Fallo temporal en listado");
      assert.equal(afterListError.sessions.length, 0);

      // Reintento de listado tiene éxito, pero el intento 1 de mensajes falla con 503
      await controller.retryLoadConversations();
      const afterMsgError = controller.getSnapshot();
      assert.equal(afterMsgError.conversationsStatus, "loaded");
      assert.equal(afterMsgError.activeSessionId, "thread-retry-1");
      assert.equal(afterMsgError.activeSession?.messagesStatus, "error");
      assert.equal(
        afterMsgError.activeSession?.messagesLoaded,
        false,
        "Un fallo de carga de mensajes NUNCA debe marcar messagesLoaded: true",
      );
      assert.equal(
        afterMsgError.activeSession?.messages.length,
        0,
        "Un error de transporte NUNCA debe guardarse como mensaje de sistema dentro del historial",
      );
      assert.equal(afterMsgError.activeSession?.messagesError, "Fallo temporal al leer mensajes");

      // Reintento de carga de mensajes recupera los mensajes reales
      await controller.retryLoadMessages();
      const afterMsgRetry = controller.getSnapshot();
      assert.equal(afterMsgRetry.activeSession?.messagesStatus, "loaded");
      assert.equal(afterMsgRetry.activeSession?.messagesLoaded, true);
      assert.equal(afterMsgRetry.activeSession?.messagesError, null);
      assert.equal(afterMsgRetry.activeSession?.messages.length, 1);
      assert.equal(
        afterMsgRetry.activeSession?.messages[0].content,
        "Mensaje recuperado tras reintento",
      );
    } finally {
      controller.dispose();
    }
  });

  it("8. Error remoto sin fallback vacío: cuando Core falla, GET /api/conversations y GET /api/conversations/[id]/messages devuelven 503 STORAGE_ERROR sin mock ni []", async () => {
    setupTestEnv();
    try {
      global.fetch = (async (url: string | URL | Request) => {
        const urlStr = String(url);
        if (urlStr.includes("/auth/v1/user")) {
          return jsonResponse({ id: TEST_OWNER_ID }, 200);
        }
        if (urlStr.includes("/api/conversations")) {
          return jsonResponse({ error: "Core database unavailable" }, 503);
        }
        return jsonResponse({}, 404);
      }) as typeof global.fetch;

      const reqList = createAuthorizedRequest("http://localhost/api/conversations");
      const resList = await getConversationsRoute(reqList);
      assert.equal(resList.status, 503, "El fallo de Core debe responder 503 y no 200 []");
      const bodyList = await resList.json();
      assert.equal(bodyList?.error?.code, "STORAGE_ERROR");

      const reqMsgs = createAuthorizedRequest("http://localhost/api/conversations/thread-1/messages");
      const resMsgs = await getConversationMessagesRoute(reqMsgs, {
        params: Promise.resolve({ id: "thread-1" }),
      });
      assert.equal(resMsgs.status, 503, "El fallo de Core al pedir mensajes debe responder 503 y no 200 []");
      const bodyMsgs = await resMsgs.json();
      assert.equal(bodyMsgs?.error?.code, "STORAGE_ERROR");
    } finally {
      restoreTestEnv();
    }
  });

  it("9. external_id frente a UUID interno: usa el identificador correcto, codifica URLs y no traga errores en resolución secundaria", async () => {
    setupTestEnv();
    try {
      const requestedCorePaths: string[] = [];
      let failSecondaryLookup = false;

      global.fetch = (async (url: string | URL | Request) => {
        const urlStr = String(url);
        if (urlStr.includes("/auth/v1/user")) {
          return jsonResponse({ id: TEST_OWNER_ID }, 200);
        }
        const parsedUrl = new URL(urlStr);
        requestedCorePaths.push(parsedUrl.pathname);

        if (parsedUrl.pathname === "/api/conversations/internal-uuid-999/messages") {
          return jsonResponse([], 200);
        }
        if (parsedUrl.pathname === "/api/conversations") {
          if (failSecondaryLookup) {
            return jsonResponse({ error: "Core crashed during secondary lookup" }, 503);
          }
          return jsonResponse(
            [
              {
                id: "internal-uuid-999",
                external_id: "ext/thread with spaces",
                title: "Hilo con caracteres especiales",
                updated_at: "2026-10-18T10:00:00.000Z",
              },
            ],
            200,
          );
        }
        if (parsedUrl.pathname === "/api/conversations/ext%2Fthread%20with%20spaces/messages") {
          return jsonResponse(
            [
              {
                id: "msg-resolved-1",
                role: "assistant",
                content: "Mensaje resuelto por external_id codificado",
                created_at: "2026-10-18 10:01:00.123456+00",
              },
            ],
            200,
          );
        }
        return jsonResponse({}, 404);
      }) as typeof global.fetch;

      // Caso A: Resolución secundaria exitosa con encodeURIComponent
      const reqOk = createAuthorizedRequest("http://localhost/api/conversations/internal-uuid-999/messages");
      const resOk = await getConversationMessagesRoute(reqOk, {
        params: { id: "internal-uuid-999" },
      });
      assert.equal(resOk.status, 200);
      const msgsOk = await resOk.json();
      assert.equal(msgsOk.length, 1);
      assert.equal(msgsOk[0].content, "Mensaje resuelto por external_id codificado");
      assert.equal(
        msgsOk[0].created_at,
        "2026-10-18T10:01:00.123Z",
        "La marca temporal TIMESTAMPTZ de PostgreSQL debe normalizarse a ISO-8601 UTC",
      );
      assert.ok(
        requestedCorePaths.includes("/api/conversations/ext%2Fthread%20with%20spaces/messages"),
        "Debe aplicar encodeURIComponent al external_id al consultar Core",
      );

      // Caso B: Si la resolución secundaria falla por error remoto, NO convierte el fallo en lista vacía silenciosa
      failSecondaryLookup = true;
      const reqFail = createAuthorizedRequest("http://localhost/api/conversations/internal-uuid-999/messages");
      const resFail = await getConversationMessagesRoute(reqFail, {
        params: { id: "internal-uuid-999" },
      });
      assert.equal(
        resFail.status,
        503,
        "Un error remoto durante la resolución secundaria jamás debe tragarse ni convertirse en 200 []",
      );
    } finally {
      restoreTestEnv();
    }
  });

  it("10. Fechas inválidas: rechaza fechas corruptas en esquemas y controlador sin inventar new Date().toISOString()", async () => {
    // 1. Validación directa en contratos Zod
    assert.equal(DanteTimestampSchema.safeParse("").success, false);
    assert.equal(DanteTimestampSchema.safeParse("not-a-date").success, false);
    assert.equal(DanteTimestampSchema.safeParse("12345").success, false);
    assert.equal(DanteTimestampSchema.safeParse("2026-13-01T00:00:00Z").success, false);
    assert.equal(DanteTimestampSchema.safeParse("2026-02-30T10:00:00Z").success, false);

    const pgValid = DanteTimestampSchema.safeParse("2026-10-18 14:30:00.500+00");
    assert.equal(pgValid.success, true);
    if (pgValid.success) {
      assert.equal(pgValid.data, "2026-10-18T14:30:00.500Z");
    }

    assert.equal(
      DanteConversationSchema.safeParse({
        id: "conv-1",
        updated_at: "fecha-invalida",
      }).success,
      false,
    );

    // Campo opcional ausente es válido (undefined), pero campo opcional con fecha inválida es rechazado
    const msgWithoutDate = DanteConversationMessageSchema.safeParse({
      id: "m-1",
      role: "user",
      content: "Hola sin fecha opcional",
    });
    assert.equal(msgWithoutDate.success, true);
    if (msgWithoutDate.success) {
      assert.equal(msgWithoutDate.data.created_at, undefined);
      assert.equal(msgWithoutDate.data.timestamp, undefined);
    }

    assert.equal(
      DanteConversationMessageSchema.safeParse({
        id: "m-2",
        role: "user",
        content: "Hola con fecha corrupta",
        created_at: "corrupt-timestamp",
      }).success,
      false,
    );

    // 2. El controlador rechaza payloads con fechas corruptas sin inventar fechas actuales
    const controller = createChatHistoryController({
      fetchFn: async (input) => {
        if (String(input) === "/api/conversations") {
          return jsonResponse(
            [
              {
                id: "conv-corrupt",
                external_id: "conv-corrupt",
                updated_at: "not-a-valid-timestamp",
              },
            ],
            200,
          );
        }
        return jsonResponse([], 200);
      },
    });

    try {
      await controller.loadConversations();
      const snap = controller.getSnapshot();
      assert.equal(snap.conversationsStatus, "error");
      assert.equal(snap.sessions.length, 0);
    } finally {
      controller.dispose();
    }
  });

  it("11. Contratos previos intactos: sessionId fallback, ownerId autenticado servidor, aserción firmada, persistence y generador criptográfico", async () => {
    setupTestEnv();
    try {
      // A. Generador criptográfico RFC 4122 v4
      const t1 = generateThreadId();
      const t2 = generateThreadId();
      assert.notEqual(t1, t2);
      assert.match(
        t1,
        /^thread-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );

      // B. Sin autenticación: 401 en conversaciones, mensajes y chat
      const unauthConv = await getConversationsRoute(new NextRequest("http://localhost/api/conversations"));
      assert.equal(unauthConv.status, 401);

      const unauthMsgs = await getConversationMessagesRoute(
        new NextRequest("http://localhost/api/conversations/abc/messages"),
        { params: { id: "abc" } },
      );
      assert.equal(unauthMsgs.status, 401);

      const unauthChat = await postChatRoute(
        new NextRequest("http://localhost/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            credentialId: "cred-1",
            messages: [{ role: "user", content: "Hola" }],
          }),
        }),
      );
      assert.equal(unauthChat.status, 401);

      // C. :id vacío rechazado con 400
      let capturedCoreHeaders: Record<string, string> = {};
      global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = String(url);
        if (urlStr.includes("/auth/v1/user")) {
          return jsonResponse({ id: TEST_OWNER_ID }, 200);
        }
        if (urlStr.includes("/api/chat")) {
          capturedCoreHeaders = (init?.headers as Record<string, string>) || {};
          return jsonResponse(
            {
              id: "core-msg-1",
              model: "gemini-3.8-flash",
              conversationId: capturedCoreHeaders["X-Conversation-ID"],
              choices: [{ message: { role: "assistant", content: "Respuesta persistencia degradada" } }],
              persistence: "unavailable",
            },
            200,
          );
        }
        return jsonResponse([], 200);
      }) as typeof global.fetch;

      const emptyIdRes = await getConversationMessagesRoute(
        createAuthorizedRequest("http://localhost/api/conversations/%20/messages"),
        { params: { id: "   " } },
      );
      assert.equal(emptyIdRes.status, 400);

      // D. POST /api/chat usa sessionId como fallback, ignora ownerId del cliente, firma el ownerId servidor y propaga persistence='unavailable'
      const chatReq = createAuthorizedRequest("http://localhost/api/chat", "POST", {
        credentialId: "cred-valid-1",
        sessionId: "legacy-session-fallback-id",
        ownerId: "spoofed-client-owner-id",
        messages: [{ role: "user", content: "Prueba integral de contratos previos" }],
      });
      const chatRes = await postChatRoute(chatReq);
      assert.equal(chatRes.status, 200);
      const chatBody = await chatRes.json();

      assert.equal(capturedCoreHeaders["X-Conversation-ID"], "legacy-session-fallback-id");
      assert.equal(chatBody.persistence, "unavailable");

      const assertionHeader = capturedCoreHeaders[OWNER_ASSERTION_HEADER];
      assert.ok(assertionHeader);
      const [seg, sig] = assertionHeader.split(".");
      const expectedSig = crypto.createHmac("sha256", TEST_CORE_TOKEN).update(seg).digest("base64url");
      assert.equal(sig, expectedSig);
      const payload = JSON.parse(Buffer.from(seg, "base64url").toString("utf8"));
      assert.equal(payload.ownerId, TEST_OWNER_ID, "El ownerId firmado debe ser el autenticado por el servidor");

      // E. El controlador expone persistenceWarning en unavailable y lo limpia cuando pasa a saved o ausente
      let nextPersistence: "unavailable" | "saved" | undefined = "unavailable";
      const controller = createChatHistoryController({
        fetchFn: async (input, init) => {
          if (String(input) === "/api/chat") {
            const body = JSON.parse(String(init?.body ?? "{}"));
            return jsonResponse(
              {
                message: { role: "assistant", content: "Respuesta" },
                status: "success",
                correlationId: String(body.conversationId),
                ...(nextPersistence ? { persistence: nextPersistence } : {}),
              },
              200,
            );
          }
          return jsonResponse([], 200);
        },
      });

      try {
        await controller.submitMessage({ text: "Msg 1", credentialId: "cred-1" });
        assert.ok(
          controller.getSnapshot().activeSession?.persistenceWarning,
          "Debe mostrar advertencia cuando persistence === 'unavailable'",
        );

        nextPersistence = undefined;
        await controller.submitMessage({ text: "Msg 2", credentialId: "cred-1" });
        assert.equal(
          controller.getSnapshot().activeSession?.persistenceWarning,
          null,
          "No debe inventar estado ni mantener advertencia obsoleta cuando persistence está ausente o saved",
        );
      } finally {
        controller.dispose();
      }
    } finally {
      restoreTestEnv();
    }
  });

  // =========================================================================
  // 12. Dos turnos con el mismo correlationId → 4 mensajes con IDs únicos
  // =========================================================================
  it("12. Dos turnos con exactamente el mismo correlationId conservan 4 mensajes y 4 IDs de mensaje distintos", async () => {
    const SHARED_CORRELATION_ID = "shared-bridge-correlation-id-constant";
    const capturedChatBodies: Array<Record<string, unknown>> = [];

    const fetchFn: FetchLike = async (input, init) => {
      const url = String(input);
      if (url === "/api/conversations") {
        return jsonResponse([], 200);
      }
      if (url === "/api/chat") {
        const body = JSON.parse(String(init?.body ?? "{}"));
        capturedChatBodies.push(body);
        const turnNum = capturedChatBodies.length;
        return jsonResponse(
          {
            message: {
              role: "assistant",
              content: `Respuesta del turno ${turnNum}`,
              timestamp: `2026-10-20T18:0${turnNum}:00.000Z`,
            },
            status: "success",
            correlationId: SHARED_CORRELATION_ID,
            persistence: "saved",
          },
          200,
        );
      }
      throw new Error(`URL inesperada: ${url}`);
    };

    const controller = createChatHistoryController({ fetchFn });
    try {
      await controller.loadConversations();

      const firstTurn = await controller.submitMessage({
        text: "Primer turno con correlationId compartido",
        credentialId: "cred-1",
      });
      assert.equal(firstTurn.ok, true);

      const secondTurn = await controller.submitMessage({
        text: "Segundo turno con el mismo correlationId",
        credentialId: "cred-1",
      });
      assert.equal(secondTurn.ok, true);

      // Mismo identificador de conversación en ambos turnos
      assert.equal(capturedChatBodies.length, 2);
      assert.equal(firstTurn.threadId, secondTurn.threadId);
      assert.equal(capturedChatBodies[0].conversationId, firstTurn.threadId);
      assert.equal(capturedChatBodies[1].conversationId, firstTurn.threadId);

      const activeThread = controller.getSnapshot().activeSession;
      assert.ok(activeThread, "Debe existir la conversación activa");
      assert.equal(activeThread.id, firstTurn.threadId);

      // Cuatro mensajes conservados en orden (user 1, assistant 1, user 2, assistant 2)
      assert.equal(activeThread.messages.length, 4);
      assert.deepEqual(
        activeThread.messages.map((m) => m.role),
        ["user", "assistant", "user", "assistant"],
      );
      assert.deepEqual(
        activeThread.messages.map((m) => m.content),
        [
          "Primer turno con correlationId compartido",
          "Respuesta del turno 1",
          "Segundo turno con el mismo correlationId",
          "Respuesta del turno 2",
        ],
      );

      // Cuatro identificadores de mensaje distintos y criptográficos (ninguno construido como `${correlationId}-a`)
      const messageIds = activeThread.messages.map((m) => m.id);
      const uniqueMessageIds = new Set(messageIds);
      assert.equal(
        uniqueMessageIds.size,
        4,
        "Los cuatro mensajes deben tener identificadores únicos entre sí",
      );
      const msgUuidV4Regex =
        /^msg-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      for (const msgId of messageIds) {
        assert.notEqual(msgId, `${SHARED_CORRELATION_ID}-a`);
        assert.match(msgId, msgUuidV4Regex);
      }

      // correlationId se conserva por separado en los mensajes del asistente
      assert.equal(activeThread.messages[1].correlationId, SHARED_CORRELATION_ID);
      assert.equal(activeThread.messages[3].correlationId, SHARED_CORRELATION_ID);

      // Verificación directa de generateMessageId
      const sampleA = generateMessageId();
      const sampleB = generateMessageId();
      assert.notEqual(sampleA, sampleB);
      assert.match(sampleA, msgUuidV4Regex);
    } finally {
      controller.dispose();
    }
  });

  // =========================================================================
  // 13. Envío bloqueado durante carga/pendiente/error de historial remoto
  // =========================================================================
  it("13. Bloquea envío en hilo remoto con historial pendiente, cargándose o en error, conserva mensajes al resolver e incluye contexto recuperado después", async () => {
    const deferredHistory = createDeferredResponse();
    let shouldFailHistory = false;
    const capturedChatCalls: Array<Record<string, unknown>> = [];

    const fetchFn: FetchLike = async (input, init) => {
      const url = String(input);
      if (url === "/api/conversations") {
        return jsonResponse(
          [
            {
              id: "11111111-2222-4333-8444-555555555555",
              external_id: "conv-remota-diferida",
              updated_at: "2026-10-20T18:00:00.000Z",
            },
            {
              id: "22222222-3333-4444-8555-666666666666",
              external_id: "conv-remota-error",
              updated_at: "2026-10-20T17:00:00.000Z",
            },
          ],
          200,
        );
      }

      if (url === "/api/conversations/conv-remota-diferida/messages") {
        return deferredHistory.promise;
      }

      if (url === "/api/conversations/conv-remota-error/messages") {
        if (shouldFailHistory) {
          return jsonResponse({ error: { message: "Error temporal leyendo historial" } }, 503);
        }
        return jsonResponse(
          [
            {
              id: "msg-remoto-err-1",
              role: "user",
              content: "Mensaje recuperado tras reintento",
              created_at: "2026-10-20T17:00:00.000Z",
            },
          ],
          200,
        );
      }

      if (url === "/api/chat") {
        const body = JSON.parse(String(init?.body ?? "{}"));
        capturedChatCalls.push(body);
        return jsonResponse(
          {
            message: {
              role: "assistant",
              content: "Respuesta con contexto completo",
              timestamp: "2026-10-20T18:05:00.000Z",
            },
            status: "success",
            correlationId: "corr-after-history",
            persistence: "saved",
          },
          200,
        );
      }

      throw new Error(`URL inesperada: ${url}`);
    };

    const controller = createChatHistoryController({ fetchFn });
    try {
      // Inicia carga de conversaciones (selecciona conv-remota-diferida y deja su historial en "loading")
      const loadConvPromise = controller.loadConversations();
      await new Promise((r) => setTimeout(r, 15));

      let snap = controller.getSnapshot();
      assert.equal(snap.activeSessionId, "conv-remota-diferida");
      assert.equal(snap.activeSession?.messagesStatus, "loading");
      assert.equal(snap.activeSession?.messagesLoaded, false);

      // A. Intentar enviar mientras el historial remoto está cargándose se bloquea en el controlador
      const blockedWhileLoading = await controller.submitMessage({
        text: "Intento prematuro mientras carga",
        credentialId: "cred-1",
      });
      assert.equal(blockedWhileLoading.ok, false);
      assert.equal(
        capturedChatCalls.length,
        0,
        "No debe llamar a /api/chat mientras el historial remoto está cargando",
      );
      snap = controller.getSnapshot();
      assert.equal(
        snap.activeSession?.messages.length,
        0,
        "No debe añadir mensaje del usuario antes de validar el estado del historial",
      );
      assert.ok(
        snap.activeSession?.sendError,
        "Debe registrar sendError explicando que el historial aún se está cargando",
      );

      // B. Resolver la respuesta diferida del historial remoto
      deferredHistory.resolve(
        jsonResponse(
          [
            {
              id: "remote-msg-1",
              role: "user",
              content: "Contexto histórico del usuario",
              created_at: "2026-10-20T17:58:00.000Z",
            },
            {
              id: "remote-msg-2",
              role: "assistant",
              content: "Contexto histórico del asistente",
              created_at: "2026-10-20T17:59:00.000Z",
            },
          ],
          200,
        ),
      );
      await loadConvPromise;

      snap = controller.getSnapshot();
      assert.equal(snap.activeSession?.messagesStatus, "loaded");
      assert.equal(snap.activeSession?.messagesLoaded, true);
      assert.equal(snap.activeSession?.messages.length, 2);
      assert.equal(snap.activeSession?.sendError, null);

      // C. Enviar después de que cargó el historial SÍ llama a /api/chat e incluye el contexto recuperado
      const sendAfterLoad = await controller.submitMessage({
        text: "Nuevo turno tras cargar historial",
        credentialId: "cred-1",
      });
      assert.equal(sendAfterLoad.ok, true);
      assert.equal(capturedChatCalls.length, 1);

      const sentMessages = capturedChatCalls[0].messages as Array<{
        role: string;
        content: string;
      }>;
      assert.equal(sentMessages.length, 3);
      assert.deepEqual(
        sentMessages.map((m) => m.content),
        [
          "Contexto histórico del usuario",
          "Contexto histórico del asistente",
          "Nuevo turno tras cargar historial",
        ],
      );
      assert.equal(controller.getSnapshot().activeSession?.messages.length, 4);

      // D. Hilo remoto en estado "error": también bloquea envío hasta reintentar carga
      shouldFailHistory = true;
      await controller.selectSession("conv-remota-error");
      snap = controller.getSnapshot();
      assert.equal(snap.activeSession?.messagesStatus, "error");
      assert.equal(snap.activeSession?.messagesLoaded, false);

      const blockedOnError = await controller.submitMessage({
        text: "Intento con historial en error",
        credentialId: "cred-1",
      });
      assert.equal(blockedOnError.ok, false);
      assert.equal(
        capturedChatCalls.length,
        1,
        "No debe llamar a /api/chat cuando el historial del hilo remoto está en error",
      );
      assert.equal(controller.getSnapshot().activeSession?.messages.length, 0);

      // Al reintentar y recuperar el historial, ya permite enviar con contexto
      shouldFailHistory = false;
      await controller.retryLoadMessages();
      assert.equal(controller.getSnapshot().activeSession?.messagesStatus, "loaded");
      assert.equal(controller.getSnapshot().activeSession?.messagesLoaded, true);

      // E. Un hilo local nuevo y vacío puede enviar normalmente sin bloqueo
      const newLocalSession = controller.createNewSession();
      const sendOnNewLocal = await controller.submitMessage({
        text: "Mensaje en hilo local nuevo",
        credentialId: "cred-1",
      });
      assert.equal(sendOnNewLocal.ok, true);
      assert.equal(sendOnNewLocal.threadId, newLocalSession.id);
      assert.equal(capturedChatCalls.length, 2);
    } finally {
      controller.dispose();
    }
  });
});
