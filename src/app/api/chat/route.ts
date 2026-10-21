import { NextRequest, NextResponse } from "next/server";
import { DanteChatRequestSchema } from "@/contracts/dante";
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

    // Si no se proporcionó credentialId en la petición, auto-resolver desde las credenciales guardadas del usuario
    let targetCredentialId = parsedRequest.data.credentialId;
    if (!targetCredentialId) {
      try {
        const listRes = await credentialHandlerDeps.core?.listCredentials(owner.ownerId);
        if (listRes?.credentials && listRes.credentials.length > 0) {
          const matched = parsedRequest.data.providerId
            ? listRes.credentials.find(c => c.providerId === parsedRequest.data.providerId)
            : listRes.credentials[0];
          targetCredentialId = matched ? matched.credentialId : listRes.credentials[0].credentialId;
        }
      } catch {
        // Fallback cerrado
      }
    }

    // Con credentialId (explícito o auto-resuelto): resolución segura
    if (targetCredentialId) {
      rawBody.credentialId = targetCredentialId;
      const byok = await handleChatWithStoredCredentialFromBody(request, rawBody, credentialHandlerDeps);
      return NextResponse.json(byok.body, { status: byok.status });
    }

    // Sin credencial guardada ni seleccionada no se usa ninguna clave de entorno ni mock:
    return NextResponse.json(
      {
        error: {
          code: 'CREDENTIAL_REQUIRED',
          message: 'Selecciona una conexion guardada para conversar con Dante.',
        },
      },
      { status: 400 },
    );
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
