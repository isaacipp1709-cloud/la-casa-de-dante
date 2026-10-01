import { NextRequest, NextResponse } from "next/server";
import { DanteChatRequestSchema, DanteChatResponseSchema } from "@/contracts/dante";
import { danteBridge } from "@/lib/dante-bridge";
import { DanteBridgeError } from "@/lib/dante-bridge/errors";

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Payload JSON malformado." } },
        { status: 400 }
      );
    }

    const parsedRequest = DanteChatRequestSchema.safeParse(body);
    if (!parsedRequest.success) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "La solicitud no cumple con el esquema esperado." } },
        { status: 400 }
      );
    }

    const bridgeResponse = await danteBridge.chat(parsedRequest.data);

    const parsedResponse = DanteChatResponseSchema.safeParse(bridgeResponse);
    if (!parsedResponse.success) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Respuesta interna inválida." } },
        { status: 500 }
      );
    }

    return NextResponse.json(parsedResponse.data, { status: 200 });
  } catch (error) {
    if (error instanceof DanteBridgeError) {
      if (error.code === "VALIDATION_ERROR") {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "No se pudo procesar la solicitud." } },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Error en el procesamiento del bridge." } },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Error inesperado del servidor." } },
      { status: 500 }
    );
  }
}
