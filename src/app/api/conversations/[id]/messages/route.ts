import { requireAuthorizedOwner } from "@/lib/auth/require-owner";
import { NextRequest, NextResponse } from "next/server";
import { danteBridge } from "@/lib/dante-bridge";
import { DanteConversationMessagesResponseSchema } from "@/contracts/dante";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const owner = await requireAuthorizedOwner(request);
  if (!owner.ok) {
    return NextResponse.json(
      { error: { code: owner.code, message: owner.message } },
      { status: owner.status }
    );
  }

  const { id } = await context.params;
  const trimmedId = typeof id === "string" ? id.trim() : "";

  if (!trimmedId) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Identificador de conversación inválido." } },
      { status: 400 }
    );
  }

  try {
    const messages = await danteBridge.getConversationMessages(trimmedId, owner.ownerId);
    const parsed = DanteConversationMessagesResponseSchema.safeParse(messages);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Respuesta de mensajes inválida." } },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: { code: "STORAGE_ERROR", message: "No fue posible obtener los mensajes de la conversación." } },
      { status: 503 }
    );
  }
}
