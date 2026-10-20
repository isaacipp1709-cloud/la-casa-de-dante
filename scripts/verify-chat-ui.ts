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
    join(UI_DIR, "chat-history-state.ts"),
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
    const stateContent = readFileSync(join(UI_DIR, "chat-history-state.ts"), "utf-8");
    const combinedUiContent = `${shellContent}\n${stateContent}`;

    // 0. Verificación de delegación directa de estado de ChatShell al controlador real
    if (!/createChatHistoryController/.test(shellContent)) {
      console.error("❌ [FAIL] chat-shell.tsx debe usar createChatHistoryController de chat-history-state.ts.");
      totalErrors++;
    } else {
      console.log("✅ chat-shell.tsx delega su máquina de estados real en createChatHistoryController.");
    }

    // 1. Verificación de transporte autenticado (authorizedFetch) y rutas de historial/chat
    if (!/authorizedFetch/.test(shellContent) || !/authorizedFetch/.test(stateContent)) {
      console.error("❌ [FAIL] chat-shell.tsx y chat-history-state.ts deben enlazar authorizedFetch.");
      totalErrors++;
    } else {
      console.log("✅ Transporte autenticado authorizedFetch enlazado en ChatShell y controlador de historial.");
    }

    if (!/(?:fetchFn|authorizedFetch)\(\s*["']\/api\/chat["']/.test(combinedUiContent)) {
      console.error("❌ [FAIL] El módulo de chat debe invocar /api/chat mediante el transporte autenticado.");
      totalErrors++;
    } else {
      console.log("✅ El módulo de chat invoca /api/chat mediante el transporte autenticado.");
    }

    if (!/(?:fetchFn|authorizedFetch)\(\s*["']\/api\/conversations["']/.test(combinedUiContent)) {
      console.error("❌ [FAIL] El módulo de chat debe invocar /api/conversations mediante el transporte autenticado.");
      totalErrors++;
    } else {
      console.log("✅ El módulo de chat invoca /api/conversations mediante el transporte autenticado.");
    }

    if (!/(?:fetchFn|authorizedFetch)\(\s*`\/api\/conversations\/\$\{encodeURIComponent\(/.test(combinedUiContent)) {
      console.error("❌ [FAIL] El módulo de chat debe invocar /api/conversations/[id]/messages con encodeURIComponent.");
      totalErrors++;
    } else {
      console.log("✅ El módulo de chat invoca /api/conversations/[id]/messages con encodeURIComponent.");
    }

    if (/\bfetch\(\s*["'`]\/api\//.test(combinedUiContent)) {
      console.error("❌ [FAIL] No se debe usar fetch plano a rutas /api/ (debe usar authorizedFetch / fetchFn).");
      totalErrors++;
    }

    // 2. Verificación de transmisión de identificadores de conversación explícitos
    const sendsConversationId = /conversationId:\s*targetThreadId\b/.test(stateContent);
    const sendsSessionId = /sessionId:\s*targetThreadId\b/.test(stateContent);
    if (!sendsConversationId || !sendsSessionId) {
      console.error("❌ [FAIL] El controlador de chat debe transmitir conversationId y sessionId explícitos (targetThreadId).");
      totalErrors++;
    } else {
      console.log("✅ El controlador de chat propaga conversationId y sessionId explícitos (targetThreadId).");
    }

    // 3. Verificación de generador criptográfico de identificadores (sin Date.now ni Math.random)
    const fnMatch = stateContent.match(/export\s+function\s+generateThreadId\s*\(\)\s*:\s*string\s*\{([\s\S]*?)\n\}/);
    const fnBody = fnMatch ? fnMatch[1] : "";
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
    const handlesPersistenceWarning = /persistence\s*===\s*["']unavailable["']/.test(combinedUiContent);
    if (!handlesPersistenceWarning) {
      console.error("❌ [FAIL] El módulo de chat debe detectar persistence === 'unavailable' y avisar al usuario.");
      totalErrors++;
    } else {
      console.log("✅ El módulo de chat detecta y alerta al usuario ante persistence === 'unavailable'.");
    }
  } catch (error: unknown) {
    console.error("❌ [FAIL] No se pudo verificar la política de transporte y contratos en el módulo de chat.", error);
    totalErrors++;
  }

  if (totalErrors > 0) {
    console.error(`\n❌ Auditoría fallida con ${totalErrors} errores de políticas.`);
    process.exit(1);
  }

  console.log("\n✅ Auditoría UI exitosa. Políticas de seguridad, contratos y transporte autenticado verificados.");
}

verifyUiFiles();
