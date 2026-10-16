import { NextRequest, NextResponse } from "next/server";
import { danteBridge } from "@/lib/dante-bridge";
import { requireAuthorizedOwner } from "@/lib/auth/require-owner";
import { AgentConnectionsResponseSchema } from "@/contracts/connections";
import { bridgeErrorMessage } from "@/lib/connections/connection-panel";

export const dynamic = "force-dynamic";

/**
 * Vista para agentes (Dante/Aikor): solo conexiones activas y seguras.
 * Sin claves, tokens, URLs internas ni detalles de configuracion.
 */
export async function GET(request: NextRequest) {
  const owner = await requireAuthorizedOwner(request);
  if (!owner.ok) {
    return NextResponse.json(
      { error: { code: owner.code, message: owner.message } },
      { status: owner.status },
    );
  }

  try {
    const available = await danteBridge.getAvailableConnections();
    const parsed = AgentConnectionsResponseSchema.safeParse(available);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Respuesta de conexiones invalida." } },
        { status: 500 },
      );
    }
    return NextResponse.json(parsed.data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: { code: "BRIDGE_ERROR", message: bridgeErrorMessage(danteBridge.getStatus().error ?? null) } },
      { status: 502 },
    );
  }
}
