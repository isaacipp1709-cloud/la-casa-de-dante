import { NextRequest, NextResponse } from "next/server";
import { danteBridge } from "@/lib/dante-bridge";
import { readServerAuthConfig, resolveOwnerFromRequest } from "@/lib/auth/server-owner";
import { createCredentialService } from "@/lib/services/credential-runtime";
import { composeConnectionsPanel } from "@/lib/connections/connection-panel";
import type { ConnectionsStatusResponse } from "@/contracts/connections";

export const dynamic = "force-dynamic";

/** Conteo de credenciales BYOK del usuario autenticado (nunca su contenido). */
async function countByokByProvider(request: NextRequest): Promise<Record<string, number>> {
  try {
    const owner = await resolveOwnerFromRequest(request);
    if (!owner.ok) return {};
    const metadata = await createCredentialService(request).listMetadata(owner.ownerId);
    const counts: Record<string, number> = {};
    for (const item of metadata) {
      counts[item.providerId] = (counts[item.providerId] ?? 0) + 1;
    }
    return counts;
  } catch {
    // Sin configuracion de credenciales el panel sigue mostrando el resto.
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
