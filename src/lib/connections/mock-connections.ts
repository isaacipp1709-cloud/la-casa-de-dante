import type { ConnectionsStatusResponse } from "../../contracts/connections";

/**
 * Estado sintetico del Core para el modo mock de La Casa (sin Core real).
 * Se identifica como temporal y nunca incluye claves ni URLs internas.
 */

export interface MockProviderEntry {
  id: string;
  name: string;
  routable: boolean;
  alwaysConfigured?: boolean;
}

export const MOCK_CONNECTION_PROVIDERS: readonly MockProviderEntry[] = [
  { id: "gemini", name: "Google Gemini", routable: true },
  { id: "huggingface", name: "Hugging Face", routable: true },
  { id: "ollama", name: "Ollama (local)", routable: true },
  { id: "groq", name: "Groq", routable: false },
  { id: "mock", name: "Mock (fallback)", routable: true, alwaysConfigured: true },
];

export interface MockConnectionsOptions {
  disabled?: string[];
  configured?: string[];
  generatedAt?: string;
}

export function buildMockCoreConnections(options: MockConnectionsOptions = {}): ConnectionsStatusResponse {
  const disabled = options.disabled ?? [];
  const configured = new Set(options.configured ?? ["mock"]);

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    storage: "temporary",
    connections: [
      {
        id: "database.neon",
        name: "Base de datos (Neon)",
        type: "database",
        owner: "system",
        canToggle: false,
        credentialSource: "none",
        status: "not_configured",
        detail: "El Core no reporta base de datos disponible.",
      },
      {
        id: "core.api",
        name: "API interna de Dante-AI-Core",
        type: "integration",
        owner: "system",
        canToggle: false,
        credentialSource: "none",
        status: "not_configured",
        detail: "Modo mock: sin Core real conectado.",
      },
      ...MOCK_CONNECTION_PROVIDERS.map((provider) => {
        const isConfigured = provider.alwaysConfigured === true || configured.has(provider.id);
        const enabled = !disabled.includes(provider.id);
        const status = !provider.routable
          ? ("incomplete" as const)
          : !isConfigured
            ? ("not_configured" as const)
            : !enabled
              ? ("disabled" as const)
              : ("active" as const);
        return {
          id: `ai.${provider.id}`,
          name: provider.name,
          type: "ai_provider" as const,
          owner: "system" as const,
          canToggle: provider.routable,
          credentialSource: (isConfigured && provider.alwaysConfigured !== true ? "system" : "none") as
            | "system"
            | "none",
          status,
          detail:
            status === "incomplete"
              ? "Adaptador no implementado todavia en el Core."
              : status === "not_configured"
                ? "Sin credencial del sistema configurada."
                : status === "disabled"
                  ? "Desactivado desde el panel; la credencial se conserva."
                  : "Disponible para ejecucion.",
        };
      }),
    ],
  };
}
