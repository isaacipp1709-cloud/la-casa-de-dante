import { readFileSync } from "fs";
import { join } from "path";

const UI_DIR = join(process.cwd(), "src", "components", "chat");

const DISALLOWED_PATTERNS = [
  { pattern: /process\.env/, reason: "Uso de process.env en UI prohibido." },
  { pattern: /STITCH_API_KEY/, reason: "Mención de STITCH_API_KEY prohibida." },
  { pattern: /GROQ_API_KEY/, reason: "Mención de GROQ_API_KEY prohibida." },
  { pattern: /SUPABASE/, reason: "Mención de Supabase directa prohibida en componentes de vista." },
  { pattern: /axios/i, reason: "Uso de Axios prohibido." },
  { pattern: /groq/i, reason: "Uso de Groq prohibido." },
  { pattern: /stitch/i, reason: "Uso de Stitch prohibido." },
  { pattern: /http:\/\//, reason: "Uso de HTTP externo prohibido." },
  { pattern: /https:\/\//, reason: "Uso de HTTPS externo prohibido." },
];

function verifyFile(filePath: string) {
  const content = readFileSync(filePath, "utf-8");
  let hasErrors = false;

  DISALLOWED_PATTERNS.forEach(({ pattern, reason }) => {
    if (pattern.test(content)) {
      console.error(`❌ [FAIL] ${filePath}: ${reason}`);
      hasErrors = true;
    }
  });

  return hasErrors;
}

function verifyUiFiles() {
  console.log("=== INICIANDO AUDITORÍA ESTÁTICA DE ARCHIVOS UI ===");
  console.log("ℹ️ [ALCANCE]: Esta auditoría realiza exclusivamente ANÁLISIS ESTÁTICO de código fuente (patrones de seguridad y contratos de interfaz). No sustituye ni constituye una prueba interactiva de navegador (E2E/DOM interactivo).\n");

  const files = [
    join(process.cwd(), "src", "app", "page.tsx"),
    join(UI_DIR, "chat-message.tsx"),
    join(UI_DIR, "chat-composer.tsx"),
    join(UI_DIR, "chat-shell.tsx"),
  ];

  let totalErrors = 0;
  for (const file of files) {
    try {
      const err = verifyFile(file);
      if (err) totalErrors++;
    } catch (e: unknown) {
      if (e instanceof Error && "code" in e && e.code === "ENOENT") {
        console.error(`❌ [FAIL] Archivo obligatorio no encontrado: ${file}`);
        totalErrors++;
      } else {
        console.error(`❌ Error al leer ${file}:`, e);
        totalErrors++;
      }
    }
  }

  try {
    const shellContent = readFileSync(join(UI_DIR, "chat-shell.tsx"), "utf-8");

    // 1. Verificación de transporte autenticado (authorizedFetch)
    if (!/authorizedFetch\(\s*["']\/api\/chat["']/.test(shellContent)) {
      console.error("❌ [FAIL] chat-shell.tsx debe usar authorizedFetch relativo a /api/chat.");
      totalErrors++;
    } else {
      console.log("✅ chat-shell.tsx utiliza authorizedFetch relativo a /api/chat.");
    }

    if (/\bfetch\(\s*["']\/api\/chat["']/.test(shellContent)) {
      console.error("❌ [FAIL] chat-shell.tsx no debe usar fetch plano a /api/chat (debe usar authorizedFetch).");
      totalErrors++;
    }

    const authFetchCalls = shellContent.match(/\bauthorizedFetch\s*\(/g) ?? [];
    if (authFetchCalls.length !== 1) {
      console.error(`❌ [FAIL] Se esperaba exactamente una llamada a authorizedFetch; se detectaron ${authFetchCalls.length}.`);
      totalErrors++;
    } else {
      console.log("✅ Exactamente una llamada a authorizedFetch detectada en el envío de mensajes.");
    }

    // 2. Verificación de transmisión de identificadores de conversación
    const sendsConversationId = /conversationId:\s*currentSession\.id\b/.test(shellContent);
    const sendsSessionId = /sessionId:\s*currentSession\.id\b/.test(shellContent);
    if (!sendsConversationId || !sendsSessionId) {
      console.error("❌ [FAIL] chat-shell.tsx debe transmitir conversationId y sessionId derivados de la sesión activa.");
      totalErrors++;
    } else {
      console.log("✅ chat-shell.tsx propaga conversationId y sessionId estables en el cuerpo de la solicitud.");
    }

    // 3. Verificación de generador criptográfico de identificadores (sin Date.now ni Math.random)
    const fnMatch = shellContent.match(/function\s+generateThreadId\s*\(\)\s*:\s*string\s*\{([\s\S]*?)\n\}/);
    const fnBody = fnMatch ? fnMatch[1] : '';
    const usesCryptoApi = fnBody.includes("crypto.randomUUID") && fnBody.includes("crypto.getRandomValues");
    const usesDateNowForId = fnBody.includes("Date.now");
    const usesMathRandomForId = fnBody.includes("Math.random");

    if (!usesCryptoApi || usesDateNowForId || usesMathRandomForId) {
      console.error("❌ [FAIL] generateThreadId debe usar exclusivamente APIs criptográficas seguras sin Date.now ni Math.random.");
      totalErrors++;
    } else {
      console.log("✅ generateThreadId implementa generación criptográfica (RFC 4122 v4) sin fallbacks a reloj o Math.random.");
    }

    // 4. Verificación de manejo del estado de persistencia
    const handlesPersistenceWarning = /data\.persistence\s*===\s*["']unavailable["']/.test(shellContent);
    if (!handlesPersistenceWarning) {
      console.error("❌ [FAIL] chat-shell.tsx debe detectar data.persistence === 'unavailable' y avisar al usuario.");
      totalErrors++;
    } else {
      console.log("✅ chat-shell.tsx detecta y alerta al usuario ante data.persistence === 'unavailable'.");
    }
  } catch (error: unknown) {
    console.error("❌ [FAIL] No se pudo verificar la política de transporte y contratos en chat-shell.tsx.", error);
    totalErrors++;
  }

  if (totalErrors > 0) {
    console.error(`\n❌ Auditoría fallida con ${totalErrors} errores de políticas.`);
    process.exit(1);
  }

  console.log("\n✅ Auditoría UI exitosa. Políticas de seguridad, contratos y transporte autenticado verificados.");
}

verifyUiFiles();
