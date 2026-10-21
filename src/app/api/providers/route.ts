import { requireAuthorizedOwner } from '@/lib/auth/require-owner';
import { NextRequest, NextResponse } from "next/server";
import { danteBridge } from "@/lib/dante-bridge";
import {
  DanteProvidersResponseSchema,
  DanteProviderCreateRequestSchema,
} from "@/contracts/dante";
import { ValidationError } from "@/lib/dante-bridge/errors";
import { ALLOWED_GEMINI_MODELS } from "@/lib/providers/gemini";

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
    const providers = await danteBridge.getProviders();

    const providersWithModels = providers.map((provider) => {
      const modelMap: Record<string, string[]> = {
        'gemini': [...ALLOWED_GEMINI_MODELS],
        'deepseek': ['deepseek-chat', 'deepseek-reasoner'],
        'nvidia': [
          'meta/llama-3.1-70b-instruct',
          'meta/llama-3.3-70b-instruct',
          'mistralai/mistral-large-2-instruct',
          'nvidia/llama-3.1-nemotron-70b-instruct',
        ],
        'groq': ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
        'openrouter': [
          'meta-llama/llama-3.3-70b-instruct:free',
          'mistralai/mistral-7b-instruct:free',
          'qwen/qwen-2.5-72b-instruct',
        ],
        'ollama': ['llama3', 'mistral', 'phi3'],
        'mock': ['mock-dante'],
        'huggingface': ['meta-llama/Meta-Llama-3-8B-Instruct', 'mistralai/Mistral-7B-Instruct-v0.2'],
      };
      const declared = Array.isArray(provider.models) ? provider.models : [];
      return { ...provider, models: declared.length > 0 ? declared : modelMap[provider.id] || [] };
    });

    const parsed = DanteProvidersResponseSchema.safeParse(providersWithModels);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Respuesta de proveedores invalida." } },
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
      { status: 400 }
    );
  }
  const parsedInput = DanteProviderCreateRequestSchema.safeParse(rawBody);
  if (!parsedInput.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Datos de proveedor invalidos." } },
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
        { error: { code: "INVALID_REQUEST", message: "Datos de proveedor invalidos." } },
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
  const owner = await requireAuthorizedOwner(request);
  if (!owner.ok) {
    return NextResponse.json(
      { error: { code: owner.code, message: owner.message } },
      { status: owner.status },
    );
  }
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "Parametro id requerido." } },
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
