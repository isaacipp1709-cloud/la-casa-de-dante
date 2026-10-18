import { requireAuthorizedOwner } from '@/lib/auth/require-owner';
import { NextRequest, NextResponse } from "next/server";
import { danteBridge } from "@/lib/dante-bridge";
import {
  DanteConnectionsResponseSchema,
  DanteDocumentIngestionRequestSchema,
  DanteDocumentIngestionResponseSchema,
} from "@/contracts/dante";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const owner = await requireAuthorizedOwner(request);
  if (!owner.ok) {
    return NextResponse.json(
      { error: { code: owner.code, message: owner.message } },
      { status: owner.status },
    );
  }
  try {
    const scope = request.nextUrl.searchParams.get("scope");
    if (scope === "documents") {
      const docs = await danteBridge.getIngestedDocuments();
      const parsedDocs = DanteDocumentIngestionResponseSchema.safeParse(docs);
      if (!parsedDocs.success) {
        return NextResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Respuesta de documentos inválida." } },
          { status: 500 }
        );
      }
      return NextResponse.json(parsedDocs.data, { status: 200 });
    }

    const connections = await danteBridge.getConnections();
    const parsed = DanteConnectionsResponseSchema.safeParse(connections);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Respuesta de conexiones inválida." } },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "No fue posible verificar las conexiones." } },
      { status: 500 }
    );
  }
}

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
      { error: { code: "INVALID_REQUEST", message: "Payload JSON inválido." } },
      { status: 400 }
    );
  }

  const parsedInput = DanteDocumentIngestionRequestSchema.safeParse(rawBody);
  if (!parsedInput.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Documento inválido para ingestión semántica." } },
      { status: 400 }
    );
  }

  try {
    const docs = await danteBridge.ingestDocument(parsedInput.data);
    const parsedOutput = DanteDocumentIngestionResponseSchema.safeParse(docs);
    if (!parsedOutput.success) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Respuesta de ingestión inválida." } },
        { status: 500 }
      );
    }
    return NextResponse.json(parsedOutput.data, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "No fue posible ingerir el documento." } },
      { status: 500 }
    );
  }
}
