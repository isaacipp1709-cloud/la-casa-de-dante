import { NextRequest, NextResponse } from "next/server";
import { DanteChatRequestSchema, DanteChatResponseSchema } from "@/contracts/dante";
import { danteBridge } from "@/lib/dante-bridge";
import { requireAuthorizedOwner } from "@/lib/auth/require-owner";
import { DanteBridgeError } from "@/lib/dante-bridge/errors";
import {
  handleChatWithStoredCredentialFromBody,
  rejectClientSuppliedApiKey,
} from "@/lib/services/credential-handlers";
import { credentialHandlerDeps } from "@/lib/services/credential-runtime";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // La sesion del panel es obligatoria: sin identidad verificada no hay chat.
  const owner = await requireAuthorizedOwner(request);
  if (!owner.ok) {
    return NextResponse.json(
      { error: { code: owner.code, message: owner.message } },
      { status: owner.status },
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Payload JSON malformado." } },
        { status: 400 }
      );
    }

    const rawBody: Record<string, unknown> =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

    // La clave nunca se acepta desde el navegador: solo credentialId.
    const clientKey = rejectClientSuppliedApiKey(rawBody);
    if (clientKey) {
      return NextResponse.json(clientKey.body, { status: clientKey.status });
    }

    const parsedRequest = DanteChatRequestSchema.safeParse(body);
    if (!parsedRequest.success) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "La solicitud no cumple con el esquema esperado." } },
        { status: 400 }
      );
    }

    // Con credentialId: resolucion segura (auth -> propietario -> descifrado -> adaptador).
    if (parsedRequest.data.credentialId) {
      const byok = await handleChatWithStoredCredentialFromBody(request, rawBody, credentialHandlerDeps);
      return NextResponse.json(byok.body, { status: byok.status });
    }

    // Sin credencial guardada no se usa ninguna clave de entorno ni mock:
    // el chat interactivo exige una conexion de la boveda.
    if (!parsedRequest.data.credentialId) {
      return NextResponse.json(
        {
          error: {
            code: 'CREDENTIAL_REQUIRED',
            message: 'Selecciona una conexion guardada para conversar con Dante.',
          },
        },
        { status: 400 },
      );
    }

    // El resto de este bloque es inalcanzable con credentialId presente.
    const bridgeResponse = await danteBridge.chat(parsedRequest.data, { verifiedOwnerId: owner.ownerId });

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
