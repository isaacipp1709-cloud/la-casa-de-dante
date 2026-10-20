import { NextRequest } from "next/server";
import { POST } from "../src/app/api/chat/route";
import { GET as getNeurons } from "../src/app/api/neurons/route";
import { GET as getAnalytics } from "../src/app/api/analytics/route";
import { GET as getConversations } from "../src/app/api/conversations/route";
import { GET as getConversationMessages } from "../src/app/api/conversations/[id]/messages/route";
import { GET as getLogs } from "../src/app/api/logs/route";
import { GET as getProviders, POST as postProvider } from "../src/app/api/providers/route";
import { GET as getConnections, POST as postConnections } from "../src/app/api/connections/route";
import { GET as getHealth } from "../src/app/api/health/route";
import {
  DanteChatResponseSchema,
  DanteNeuronsResponseSchema,
  DanteAnalyticsSchema,
  DanteConversationsResponseSchema,
  DanteConversationMessagesResponseSchema,
  DanteLogsResponseSchema,
  DanteProvidersResponseSchema,
  DanteConnectionsResponseSchema,
  DanteHealthResponseSchema,
  DanteDocumentIngestionResponseSchema,
} from "../src/contracts/dante";

const TEST_OWNER_ID = "test-authorized-owner-uuid-123";
const TEST_TOKEN = "test-valid-bearer-token-route-verify";

function createUnauthenticatedRequest(bodyStr: string) {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: bodyStr,
  });
}

function createAuthorizedRequest(urlStr: string, method = "POST", bodyStr?: string) {
  return new NextRequest(urlStr, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TEST_TOKEN}`,
    },
    body: bodyStr,
  });
}

async function runTests() {
  console.log("=== INICIANDO VERIFICACIÓN DE ROUTE /api/chat ===");

  const originalFetch = global.fetch;

  // Variables de entorno previas para restauración limpia
  const envSnapshot: Record<string, string | undefined> = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    DANTE_AUTHORIZED_OWNER_IDS: process.env.DANTE_AUTHORIZED_OWNER_IDS,
    DANTE_CORE_TOKEN: process.env.DANTE_CORE_TOKEN,
    CREDENTIAL_MASTER_SECRET: process.env.CREDENTIAL_MASTER_SECRET,
  };

  const hadEnv: Record<string, boolean> = {
    SUPABASE_URL: "SUPABASE_URL" in process.env,
    SUPABASE_ANON_KEY: "SUPABASE_ANON_KEY" in process.env,
    DANTE_AUTHORIZED_OWNER_IDS: "DANTE_AUTHORIZED_OWNER_IDS" in process.env,
    DANTE_CORE_TOKEN: "DANTE_CORE_TOKEN" in process.env,
    CREDENTIAL_MASTER_SECRET: "CREDENTIAL_MASTER_SECRET" in process.env,
  };

  // Configuración de fixtures/dependencias de prueba (sin servicios reales)
  process.env.SUPABASE_URL = "http://mock-supabase.local";
  process.env.SUPABASE_ANON_KEY = "mock-anon-key-verify";
  process.env.DANTE_AUTHORIZED_OWNER_IDS = TEST_OWNER_ID;
  process.env.DANTE_CORE_TOKEN = "test-core-token-verify-chat-route";
  process.env.CREDENTIAL_MASTER_SECRET = "test-master-secret-32-chars-long!!";

  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = String(url);

    // Mock autenticación Supabase Auth (/auth/v1/user)
    if (urlStr.includes("/auth/v1/user")) {
      const authHeader =
        (init?.headers as any)?.authorization ||
        (init?.headers as any)?.Authorization ||
        "";
      if (authHeader === `Bearer ${TEST_TOKEN}`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: TEST_OWNER_ID }),
        } as unknown as Response;
      }
      return {
        ok: false,
        status: 401,
        json: async () => ({ message: "Invalid token" }),
      } as unknown as Response;
    }

    // Mock Core endpoint de chat
    if (urlStr.includes("/api/chat")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "route-mock-msg-1",
          model: "gemini-3.8-flash",
          conversationId: "route-session-123",
          choices: [
            {
              message: {
                role: "assistant",
                content: "Hola desde ruta /api/chat verificada con identidad autorizada.",
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
          persistence: "saved",
        }),
      } as unknown as Response;
    }

    // Mock Core endpoints complementarios
    if (urlStr.includes("/api/conversations") && !urlStr.includes("/messages")) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            id: "route-conv-uuid-1",
            external_id: "route-session-123",
            updated_at: new Date().toISOString(),
          },
        ],
      } as unknown as Response;
    }

    if (urlStr.includes("/messages")) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            id: "msg-123",
            role: "user",
            content: "Mensaje de prueba en ruta",
            created_at: new Date().toISOString(),
          },
        ],
      } as unknown as Response;
    }

    if (urlStr.includes("/api/health")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "ok" }),
      } as unknown as Response;
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    } as unknown as Response;
  }) as typeof global.fetch;

  try {
    // 0. Comprobación de rechazo de solicitudes no autenticadas (401 UNAUTHORIZED)
    console.log("\n[TEST 0] Rechazo de solicitudes no autenticadas (401 UNAUTHORIZED)...");
    const unauthReq = createUnauthenticatedRequest(
      JSON.stringify({ messages: [{ role: "user", content: "Hola sin token" }] })
    );
    const unauthRes = await POST(unauthReq);
    const unauthJson = await unauthRes.json();
    if (unauthRes.status === 401 && unauthJson.error?.code === "UNAUTHORIZED") {
      console.log("✅ OK (Status 401, rechazo sin autenticación confirmado).");
    } else {
      console.error("❌ Falló TEST 0", unauthRes.status, unauthJson);
      process.exit(1);
    }

    // 1. Solicitud autorizada pero sin credencial guardada (400 CREDENTIAL_REQUIRED)
    console.log("\n[TEST 1] Solicitud autorizada sin credencial guardada...");
    const noCredReq = createAuthorizedRequest(
      "http://localhost/api/chat",
      "POST",
      JSON.stringify({
        messages: [{ role: "user", content: "Hola Dante" }],
        sessionId: "route-session",
      })
    );
    const noCredRes = await POST(noCredReq);
    const noCredJson = await noCredRes.json();
    if (noCredRes.status === 400 && noCredJson.error?.code === "CREDENTIAL_REQUIRED") {
      console.log("✅ OK (Status 400, CREDENTIAL_REQUIRED: guarda productiva de credencial confirmada).");
    } else {
      console.error("❌ Falló TEST 1", noCredRes.status, noCredJson);
      process.exit(1);
    }

    // 2. Solicitud autorizada válida con credentialId (200 OK + Schema DanteChatResponse)
    console.log("\n[TEST 2] Solicitud autorizada válida con credentialId...");
    const validReq = createAuthorizedRequest(
      "http://localhost/api/chat",
      "POST",
      JSON.stringify({
        messages: [{ role: "user", content: "Hola Dante con BYOK" }],
        conversationId: "thread-route-uuid-1",
        credentialId: "cred-route-test-1",
      })
    );
    const validRes = await POST(validReq);
    const validJson = await validRes.json();
    if (validRes.status === 200 && DanteChatResponseSchema.safeParse(validJson).success) {
      console.log(`✅ OK (Status 200, schema válido). correlationId: ${validJson.correlationId}, persistence: ${validJson.persistence}`);
    } else {
      console.error("❌ Falló TEST 2", validRes.status, validJson);
      process.exit(1);
    }

    // 3. JSON malformado (400 INVALID_REQUEST)
    console.log("\n[TEST 3] JSON malformado...");
    const malformedReq = createAuthorizedRequest("http://localhost/api/chat", "POST", "{ bad json ]");
    const malformedRes = await POST(malformedReq);
    const malformedJson = await malformedRes.json();
    if (malformedRes.status === 400 && malformedJson.error?.code === "INVALID_REQUEST") {
      console.log("✅ OK (Status 400, error.code === INVALID_REQUEST).");
    } else {
      console.error("❌ Falló TEST 3", malformedRes.status, malformedJson);
      process.exit(1);
    }

    // 4. Payload JSON estructuralmente inválido (400 INVALID_REQUEST, sin filtración)
    console.log("\n[TEST 4] JSON estructuralmente inválido...");
    const invalidSchemaReq = createAuthorizedRequest(
      "http://localhost/api/chat",
      "POST",
      JSON.stringify({
        messages: [{ role: "alien", content: "Hola" }],
      })
    );
    const invalidSchemaRes = await POST(invalidSchemaReq);
    const invalidSchemaJson = await invalidSchemaRes.json();
    if (invalidSchemaRes.status === 400 && invalidSchemaJson.error?.code === "INVALID_REQUEST") {
      if (JSON.stringify(invalidSchemaJson).includes("alien")) {
        console.error("❌ Falló TEST 4: Filtración de datos de usuario en error.");
        process.exit(1);
      }
      console.log("✅ OK (Status 400, error.code === INVALID_REQUEST, sin filtración de inputs).");
    } else {
      console.error("❌ Falló TEST 4", invalidSchemaRes.status, invalidSchemaJson);
      process.exit(1);
    }

    // 5. Rechazo de API key enviada directamente por cliente
    console.log("\n[TEST 5] Rechazo de API key directa del cliente...");
    const apiKeyReq = createAuthorizedRequest(
      "http://localhost/api/chat",
      "POST",
      JSON.stringify({
        messages: [{ role: "user", content: "Intento enviar mi key" }],
        apiKey: "sk-client-prohibited-key-12345",
      })
    );
    const apiKeyRes = await POST(apiKeyReq);
    const apiKeyJson = await apiKeyRes.json();
    if (
      apiKeyRes.status === 400 &&
      apiKeyJson.error?.code === "INVALID_REQUEST" &&
      apiKeyJson.error?.message?.includes("API keys must not be sent by the client")
    ) {
      console.log("✅ OK (Status 400, rechazo de API key en cliente confirmado).");
    } else {
      console.error("❌ Falló TEST 5", apiKeyRes.status, apiKeyJson);
      process.exit(1);
    }

    // 6. Verificando rutas API unificadas con identidad autorizada
    console.log("\n[TEST 6] Verificando rutas API unificadas con identidad autorizada...");
    const [
      neuronsRes,
      analyticsRes,
      conversationsRes,
      messagesRes,
      logsRes,
      providersRes,
      connectionsRes,
      docsRes,
      healthRes,
    ] = await Promise.all([
      getNeurons(createAuthorizedRequest("http://localhost/api/neurons", "GET")),
      getAnalytics(createAuthorizedRequest("http://localhost/api/analytics", "GET")),
      getConversations(createAuthorizedRequest("http://localhost/api/conversations", "GET")),
      getConversationMessages(createAuthorizedRequest("http://localhost/api/conversations/route-session-123/messages", "GET"), { params: { id: "route-session-123" } }),
      getLogs(createAuthorizedRequest("http://localhost/api/logs", "GET")),
      getProviders(createAuthorizedRequest("http://localhost/api/providers", "GET")),
      getConnections(createAuthorizedRequest("http://localhost/api/connections", "GET")),
      getConnections(createAuthorizedRequest("http://localhost/api/connections?scope=documents", "GET")),
      getHealth(),
    ]);

    const neuronsOk = neuronsRes.status === 200 && DanteNeuronsResponseSchema.safeParse(await neuronsRes.json()).success;
    const analyticsOk = analyticsRes.status === 200 && DanteAnalyticsSchema.safeParse(await analyticsRes.json()).success;
    const conversationsOk = conversationsRes.status === 200 && DanteConversationsResponseSchema.safeParse(await conversationsRes.json()).success;
    const messagesOk = messagesRes.status === 200 && DanteConversationMessagesResponseSchema.safeParse(await messagesRes.json()).success;
    const logsOk = logsRes.status === 200 && DanteLogsResponseSchema.safeParse(await logsRes.json()).success;
    const providersOk = providersRes.status === 200 && DanteProvidersResponseSchema.safeParse(await providersRes.json()).success;
    const connectionsOk = connectionsRes.status === 200 && DanteConnectionsResponseSchema.safeParse(await connectionsRes.json()).success;
    const docsOk = docsRes.status === 200 && DanteDocumentIngestionResponseSchema.safeParse(await docsRes.json()).success;
    const healthOk = healthRes.status === 200 && DanteHealthResponseSchema.safeParse(await healthRes.json()).success;

    const invalidProvReq = createAuthorizedRequest(
      "http://localhost/api/providers",
      "POST",
      JSON.stringify({ name: "", category: "" })
    );
    const invalidProvRes = await postProvider(invalidProvReq);

    const validDocReq = createAuthorizedRequest(
      "http://localhost/api/connections",
      "POST",
      JSON.stringify({
        title: "Directiva de Prueba N26",
        category: "arquitectura",
        content: "Contenido validado por DanteDocumentIngestionRequestSchema.",
      })
    );
    const validDocRes = await postConnections(validDocReq);

    if (
      neuronsOk &&
      analyticsOk &&
      conversationsOk &&
      messagesOk &&
      logsOk &&
      providersOk &&
      connectionsOk &&
      docsOk &&
      healthOk &&
      invalidProvRes.status === 400 &&
      validDocRes.status === 201
    ) {
      console.log("✅ OK: Las rutas API unificadas (incluyendo conversaciones y mensajes) responden con estricta autorización y esquemas válidos.");
    } else {
      console.error("❌ Falló TEST 6 en alguna ruta API unificada.", {
        neuronsOk,
        analyticsOk,
        conversationsOk,
        messagesOk,
        logsOk,
        providersOk,
        connectionsOk,
        docsOk,
        healthOk,
        invalidProvStatus: invalidProvRes.status,
        validDocStatus: validDocRes.status,
      });
      process.exit(1);
    }

    console.log("\n=== TODAS LAS PRUEBAS DE VERIFY:CHAT-ROUTE PASARON ===");
  } finally {
    // Restauración limpia de entorno y fetch
    if (typeof originalFetch === "function") {
      global.fetch = originalFetch;
    } else {
      delete (global as any).fetch;
    }

    for (const [key, existed] of Object.entries(hadEnv)) {
      if (existed) {
        process.env[key] = envSnapshot[key];
      } else {
        delete process.env[key];
      }
    }
  }
}

runTests().catch((e) => {
  console.error("❌ Error global en verify:chat-route:", e);
  process.exit(1);
});
