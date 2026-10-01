import { readFileSync } from "fs";
import { join } from "path";

const UI_DIR = join(process.cwd(), "src", "components", "chat");

const DISALLOWED_PATTERNS = [
  { pattern: /process\.env/, reason: "Uso de process.env en UI prohibido." },
  { pattern: /STITCH_API_KEY/, reason: "Mención de STITCH_API_KEY prohibida." },
  { pattern: /GROQ_API_KEY/, reason: "Mención de GROQ_API_KEY prohibida." },
  { pattern: /SUPABASE/, reason: "Mención de Supabase prohibida." },
  { pattern: /axios/i, reason: "Uso de Axios prohibido." },
  { pattern: /groq/i, reason: "Uso de Groq prohibido." },
  { pattern: /supabase/i, reason: "Uso de Supabase prohibido." },
  { pattern: /stitch/i, reason: "Uso de Stitch prohibido." },
  { pattern: /http:\/\//, reason: "Uso de HTTP externo prohibido." },
  { pattern: /https:\/\//, reason: "Uso de HTTPS externo prohibido." }
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
  console.log("Auditoría estática de archivos UI...");
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
    if (!/fetch\(\s*["']\/api\/chat["']/.test(shellContent)) {
      console.error("❌ [FAIL] chat-shell.tsx debe usar fetch relativo a /api/chat.");
      totalErrors++;
    }
    const fetchCalls = shellContent.match(/\bfetch\s*\(/g) ?? [];
    if (fetchCalls.length !== 1) {
      console.error(`❌ [FAIL] Se esperaba exactamente una llamada a fetch; se detectaron ${fetchCalls.length}.`);
      totalErrors++;
    }
  } catch (error: unknown) {
    console.error(
      "❌ [FAIL] No se pudo verificar la política de fetch en chat-shell.tsx.",
      error,
    );
    totalErrors++;
  }

  if (totalErrors > 0) {
    console.error(`\n❌ Auditoría fallida con ${totalErrors} errores de políticas.`);
    process.exit(1);
  }

  console.log("✅ Auditoría UI exitosa. No se detectaron violaciones.");
}

verifyUiFiles();
