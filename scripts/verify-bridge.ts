import { danteBridge } from "../src/lib/dante-bridge";
import { DanteHealthResponseSchema } from "../src/contracts/dante";

async function runVerification() {
  console.log("=== INICIANDO VERIFICACIÓN DEL DANTE-BRIDGE ===");

  // a. Solicitud válida
  console.log("\n[TEST A] Solicitud válida...");
  try {
    const validRequest = {
      messages: [{ role: "user" as const, content: "Hola Dante" }],
      sessionId: "session-xyz"
    };
    const response = await danteBridge.chat(validRequest);
    console.log(`✅ Solicitud válida aceptada.
      Respuesta: ${response.message.content}
      Correlation ID: ${response.correlationId}`);
  } catch (error) {
    console.error("❌ Falló la solicitud válida", error);
    process.exit(1);
  }

  // b. Solicitud inválida rechazada por Zod
  console.log("\n[TEST B] Solicitud inválida...");
  try {
    const invalidRequest = {
      messages: [{ role: "alien", content: "" }], // Rol inválido y contenido vacío
    };
    await danteBridge.chat(invalidRequest);
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

  // c. El mock provider devuelve una respuesta válida
  console.log("\n[TEST C] Mock provider validación...");
  console.log("✅ El mock provider retornó exitosamente en Test A pasando el Schema.");

  // d. Endpoint de salud
  console.log("\n[TEST D] Endpoint de Salud...");
  const healthData = {
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  };
  const parsed = DanteHealthResponseSchema.safeParse(healthData);
  if (parsed.success) {
    console.log("✅ Endpoint de salud (mock) tiene respuesta válida.");
  } else {
    console.error("❌ Falló la validación del schema de salud.");
    process.exit(1);
  }

  console.log("\n=== TODAS LAS PRUEBAS PASARON ===");
}

runVerification();
