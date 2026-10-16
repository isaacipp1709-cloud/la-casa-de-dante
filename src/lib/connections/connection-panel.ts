import {
  ConnectionsPanelSchema,
  type CasaConnection,
  type Connection,
  type ConnectionsPanel,
  type ConnectionsStatusResponse,
} from "../../contracts/connections";

/**
 * Compone el panel de conexiones de La Casa.
 *
 * - Reutiliza el estado del Core pero SOLO copia campos de una lista blanca:
 *   cualquier dato ajeno al contrato (claves, tokens, URLs) no puede filtrarse.
 * - Agrega las filas propias de La Casa: bridge y autenticacion Supabase.
 * - Superpone el estado BYOK del usuario autenticado (solo conteos, nunca valores).
 */

export interface ComposeConnectionsInput {
  core: ConnectionsStatusResponse | null;
  bridgeReachable: boolean;
  bridgeError?: string | null;
  authConfigured: boolean;
  byokCounts?: Record<string, number>;
  generatedAt?: string;
}

/** Mensaje claro y sanitizado: nunca se reenvía el error crudo del bridge. */
export function bridgeErrorMessage(error?: string | null): string {
  if (!error) return "No se pudo contactar a Dante-AI-Core.";
  if (error === "TIMEOUT") return "Dante-AI-Core no respondio a tiempo.";
  if (error.startsWith("CORE_HTTP_")) return "Dante-AI-Core respondio con error.";
  if (error === "CORE_ERROR") return "Dante-AI-Core devolvio un error.";
  return "No se pudo contactar a Dante-AI-Core.";
}

function withByok(base: Connection, byokAvailable: boolean): CasaConnection {
  const systemCredential = base.credentialSource === "system";
  const credentialSource = systemCredential && byokAvailable
    ? "both"
    : byokAvailable
      ? "byok"
      : systemCredential
        ? "system"
        : "none";

  return { ...base, byokAvailable, credentialSource };
}

export function composeConnectionsPanel(input: ComposeConnectionsInput): ConnectionsPanel {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const byokCounts = input.byokCounts ?? {};

  const connections: CasaConnection[] = [];

  connections.push({
    id: "bridge.core",
    name: "Bridge Dante-AI-Core",
    type: "bridge",
    owner: "system",
    canToggle: false,
    credentialSource: "none",
    byokAvailable: false,
    status: input.bridgeReachable ? "active" : "incomplete",
    detail: input.bridgeReachable
      ? "La Casa se comunica con Dante-AI-Core."
      : bridgeErrorMessage(input.bridgeError),
  });

  connections.push({
    id: "auth.supabase",
    name: "Autenticacion (Supabase)",
    type: "auth",
    owner: "system",
    canToggle: false,
    credentialSource: input.authConfigured ? "system" : "none",
    byokAvailable: false,
    status: input.authConfigured ? "active" : "not_configured",
    detail: input.authConfigured
      ? "La Casa verifica sesiones contra Supabase."
      : "Falta la configuracion de Supabase en el servidor.",
  });

  for (const connection of input.core?.connections ?? []) {
    // Lista blanca: solo se copian campos del contrato.
    connections.push(
      withByok(
        {
          id: connection.id,
          name: connection.name,
          type: connection.type,
          status: connection.status,
          owner: connection.owner,
          canToggle: connection.canToggle,
          credentialSource: connection.credentialSource,
          detail: connection.detail,
        },
        (byokCounts[connection.id.replace(/^ai\./, "")] ?? 0) > 0,
      ),
    );
  }

  return ConnectionsPanelSchema.parse({
    generatedAt,
    storage: input.core?.storage ?? "temporary",
    bridge: { reachable: input.bridgeReachable, error: input.bridgeReachable ? undefined : bridgeErrorMessage(input.bridgeError) },
    connections,
  });
}
