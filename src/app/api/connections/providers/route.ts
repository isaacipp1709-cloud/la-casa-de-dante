import { NextRequest, NextResponse } from "next/server";
import { danteBridge } from "@/lib/dante-bridge";
import { requireAuthorizedOwner } from "@/lib/auth/require-owner";
import { ProviderToggleRequestSchema } from "@/contracts/connections";
import { bridgeErrorMessage, composeConnectionsPanel } from "@/lib/connections/connection-panel";

export const dynamic = "force-dynamic";

/**
 * Activa o desactiva un proveedor. Requiere sesion autenticada del servidor.
 * Desactivar NO elimina la credencial: solo impide su uso.
 */
export async function POST(request: NextRequest) {
  const owner = await requireAuthorizedOwner(request);
  if (!owner.ok) {
    return NextResponse.json(
      { error: { code: owner.code, message: owner.message } },
      { status: owner.status },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Payload JSON invalido." } },
      { status: 400 },
    );
  }

  const parsed = ProviderToggleRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "providerId y enabled son requeridos." } },
      { status: 400 },
    );
  }

  try {
    const core = await danteBridge.toggleProviderConnection(
      parsed.data.providerId,
      parsed.data.enabled,
      owner.ownerId,
    );
    const bridge = danteBridge.getStatus();
    const panel = composeConnectionsPanel({
      core,
      bridgeReachable: bridge.state === "CONNECTED",
      bridgeError: bridge.error ?? null,
      authConfigured: true,
    });
    return NextResponse.json(panel, { status: 200 });
  } catch {
    const message = bridgeErrorMessage(danteBridge.getStatus().error ?? null);
    return NextResponse.json(
      { error: { code: "BRIDGE_ERROR", message } },
      { status: 502 },
    );
  }
}
