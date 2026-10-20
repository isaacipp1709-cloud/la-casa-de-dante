import { danteBridge } from "../src/lib/dante-bridge";
import {
  DanteChatResponseSchema,
  DanteHealthResponseSchema,
  DanteNeuronsResponseSchema,
  DanteAnalyticsSchema,
  DanteConversationsResponseSchema,
  DanteLogsResponseSchema,
  DanteProvidersResponseSchema,
  DanteConnectionsResponseSchema,
} from "../src/contracts/dante";

async function runVerification() {
  console.log("=== INICIANDO VERIFICACIÓN DEL DANTE-BRIDGE ===");

  const hadToken = "DANTE_CORE_TOKEN" in process.env;
  const originalToken = process.env.DANTE_CORE_TOKEN;
  const originalFetch = global.fetch;

  // Configuración de dependencias de prueba aisladas (sin red ni Core real)
  process.env.DANTE_CORE_TOKEN = "test-token-verify-bridge-isolation-token";

  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = String(url);
    if (urlStr.includes("/api/chat")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "bridge-mock-msg-1",
          model: "dante-ai-local",
          conversationId: "session-xyz",
          choices: [
            {
              message: {
                role: "assistant",
                content: "Hola desde Dante Bridge verificado en aislamiento.",
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
          persistence: "disabled",
        }),
      } as unknown as Response;
    }
    if (urlStr.includes("/messages")) {
      return {
        ok: true,
        status: 200,
        json: async () => [],
      } as unknown as Response;
    }
    if (urlStr.includes("/api/health")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: "ok",
          timestamp: new Date().toISOString(),
          version: "1.0.0",
          services: { llm: "ok", database: "ok" },
        }),
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: "ok" }),
    } as unknown as Response;
  }) as typeof global.fetch;

  try {
    // a. Solicitud válida con identidad firmada (verifiedOwnerId de prueba)
    console.log("\n[TEST A] Solicitud válida con contrato de identidad firmada...");
    const validRequest = {
      messages: [{ role: "user" as const, content: "Hola Dante" }],
      sessionId: "session-xyz",
    };
    const response = await danteBridge.chat(validRequest, {
      verifiedOwnerId: "test-owner-uuid-verify-bridge",
    });

    const parsedResponse = DanteChatResponseSchema.safeParse(response);
    if (!parsedResponse.success) {
      console.error("❌ La respuesta no cumple el esquema DanteChatResponseSchema:", parsedResponse.error);
      process.exit(1);
    }

    console.log(`✅ Solicitud válida aceptada.
      Respuesta: ${response.message.content}
      Correlation ID: ${response.correlationId}
      Persistence: ${response.persistence}`);

    // b. Solicitud inválida rechazada por Zod
    console.log("\n[TEST B] Solicitud inválida rechazada por Zod...");
    try {
      const invalidRequest = {
        messages: [{ role: "alien", content: "" }],
      };
      await danteBridge.chat(invalidRequest, {
        verifiedOwnerId: "test-owner-uuid-verify-bridge",
      });
      console.error("❌ La solicitud inválida NO fue rechazada.");
      process.exit(1);
    } catch (error: any) {
      if (error.name === "ValidationError") {
        console.log("✅ Solicitud inválida rechazada por Zod exitosamente.");
      } else {
        console.error("❌ Error inesperado:", error);
        process.exit(1);
      }
    }

    // c. Verificación de contrato del Mock Provider
    console.log("\n[TEST C] Mock provider validación de contrato...");
    console.log("✅ El mock provider retornó exitosamente en Test A pasando DanteChatResponseSchema.");

    // d. Endpoint de salud
    console.log("\n[TEST D] Endpoint de Salud...");
    const healthData = await danteBridge.getHealth();
    const parsedHealth = DanteHealthResponseSchema.safeParse(healthData);
    if (parsedHealth.success) {
      console.log("✅ Endpoint de salud tiene respuesta válida.");
    } else {
      console.error("❌ Falló la validación del schema de salud.", parsedHealth.error);
      process.exit(1);
    }

    // e. Verificación unificada de rutas del puente
    console.log("\n[TEST E] Verificando contratos Zod de capacidades del puente...");
    const neurons = await danteBridge.getNeurons();
    const analytics = await danteBridge.getAnalytics();
    const conversations = await danteBridge.getConversations("test-owner-uuid-verify-bridge");
    const logs = await danteBridge.getLogs();
    const providers = await danteBridge.getProviders();
    const connections = await danteBridge.getConnections();
    const ingestedDocs = await danteBridge.getIngestedDocuments();

    if (
      neurons.length !== 37 ||
      !DanteNeuronsResponseSchema.safeParse(neurons).success ||
      !DanteAnalyticsSchema.safeParse(analytics).success ||
      !DanteConversationsResponseSchema.safeParse(conversations).success ||
      !DanteLogsResponseSchema.safeParse(logs).success ||
      !DanteProvidersResponseSchema.safeParse(providers).success ||
      !DanteConnectionsResponseSchema.safeParse(connections).success ||
      ingestedDocs.length < 2
    ) {
      console.error("❌ Falló la validación de alguno de los esquemas unificados del puente o de las 37 neuronas.");
      process.exit(1);
    }
    console.log("✅ Todos los esquemas (37 Neuronas, Analítica, Conversaciones, Logs, Proveedores, Conexiones, Documentos) validados con z.safeParse().");

    console.log("\n=== TODAS LAS PRUEBAS DE VERIFY:BRIDGE PASARON ===");
  } finally {
    // Restauración limpia de dependencias y entorno
    if (typeof originalFetch === "function") {
      global.fetch = originalFetch;
    } else {
      delete (global as any).fetch;
    }
    if (hadToken) {
      process.env.DANTE_CORE_TOKEN = originalToken;
    } else {
      delete process.env.DANTE_CORE_TOKEN;
    }
  }
}

runVerification().catch((err) => {
  console.error("❌ Error inesperado en verify:bridge:", err);
  process.exit(1);
});
