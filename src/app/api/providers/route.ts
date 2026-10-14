import { NextRequest, NextResponse } from "next/server";
import { danteBridge } from "@/lib/dante-bridge";
import {
  DanteProvidersResponseSchema,
  DanteProviderCreateRequestSchema,
} from "@/contracts/dante";
import { ValidationError } from "@/lib/dante-bridge/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const providers = await danteBridge.getProviders();
    const parsed = DanteProvidersResponseSchema.safeParse(providers);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Respuesta de proveedores inválida." } },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "No fue posible obtener los proveedores." } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Payload JSON inválido." } },
      { status: 400 }
    );
  }

  const parsedInput = DanteProviderCreateRequestSchema.safeParse(rawBody);
  if (!parsedInput.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Datos de proveedor inválidos." } },
      { status: 400 }
    );
  }

  try {
    const updated = await danteBridge.addProvider(parsedInput.data);
    const parsedOutput = DanteProvidersResponseSchema.safeParse(updated);
    if (!parsedOutput.success) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Error al validar respuesta." } },
        { status: 500 }
      );
    }
    return NextResponse.json(parsedOutput.data, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Datos de proveedor inválidos." } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "No fue posible registrar el proveedor." } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Parámetro id requerido." } },
      { status: 400 }
    );
  }

  try {
    const updated = await danteBridge.removeProvider(id);
    const parsedOutput = DanteProvidersResponseSchema.safeParse(updated);
    if (!parsedOutput.success) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Error al validar respuesta." } },
        { status: 500 }
      );
    }
    return NextResponse.json(parsedOutput.data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "No fue posible eliminar el proveedor." } },
      { status: 500 }
    );
  }
}
