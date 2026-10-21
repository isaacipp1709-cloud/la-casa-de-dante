import { requireAuthorizedOwner } from "@/lib/auth/require-owner";
import { NextRequest, NextResponse } from "next/server";
import { danteBridge } from "@/lib/dante-bridge";
import { DanteConversationsResponseSchema } from "@/contracts/dante";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const owner = await requireAuthorizedOwner(request);
  if (!owner.ok) {
    return NextResponse.json(
      { error: { code: owner.code, message: owner.message } },
      { status: owner.status }
    );
  }
  try {
    let conversations;
    try {
      conversations = await danteBridge.getConversations(owner.ownerId);
    } catch {
      // Reintento silencioso para absorber posibles arranques en frío (cold-start) de Neon / Core
      await new Promise((resolve) => setTimeout(resolve, 600));
      conversations = await danteBridge.getConversations(owner.ownerId);
    }
    const parsed = DanteConversationsResponseSchema.safeParse(conversations);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Respuesta de conversaciones inválida." } },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: { code: "STORAGE_ERROR", message: "No fue posible obtener el historial." } },
      { status: 503 }
    );
  }
}
