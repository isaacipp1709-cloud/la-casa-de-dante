import { NextRequest, NextResponse } from "next/server";
import { danteBridge } from "@/lib/dante-bridge";
import { readServerAuthConfig, resolveOwnerFromRequest } from "@/lib/auth/server-owner";
import { createCredentialService } from "@/lib/services/credential-runtime";
import { composeConnectionsPanel } from "@/lib/connections/connection-panel";
import type { ConnectionsStatusResponse } from "@/contracts/connections";

export const dynamic = "force-dynamic";

/** Conteo de credenciales BYOK del usuario (nunca su contenido). */
function tally(credentials: Array<{ providerId: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of credentials) {
    counts[item.providerId] = (counts[item.providerId] ?? 0) + 1;
  }
  return counts;
}

/**
 * Las credenciales viven en Dante-AI-Core: el conteo se pide al Core con la
 * identidad firmada. Si el Core no responde, se usa el fallback temporal local.
 */
async function countByokByProvider(request: NextRequest): Promise<Record<string, number>> {
  try {
    const owner = await resolveOwnerFromRequest(request);
    if (!owner.ok) return {};

    try {
      const fromCore = await danteBridge.listCredentials(owner.ownerId);
      return tally(fromCore.credentials);
    } catch {
      const local = await createCredentialService().listMetadata(owner.ownerId);
      return tally(local);
    }
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  const byokCounts = await countByokByProvider(request);

  let core: ConnectionsStatusResponse | null = null;
  try {
    core = await danteBridge.getConnectionsStatus();
  } catch {
    core = null;
  }

  const bridge = danteBridge.getStatus();
  const panel = composeConnectionsPanel({
    core,
    bridgeReachable: bridge.state === "CONNECTED",
    bridgeError: bridge.error ?? null,
    authConfigured: readServerAuthConfig(process.env) !== null,
    byokCounts,
  });

  return NextResponse.json(panel, { status: 200 });
}
