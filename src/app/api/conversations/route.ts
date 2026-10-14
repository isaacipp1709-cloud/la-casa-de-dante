import { NextResponse } from "next/server";
import { danteBridge } from "@/lib/dante-bridge";
import { DanteConversationsResponseSchema } from "@/contracts/dante";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const conversations = await danteBridge.getConversations();
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
      { error: { code: "INTERNAL_ERROR", message: "No fue posible obtener el historial." } },
      { status: 500 }
    );
  }
}
