import { NextResponse } from "next/server";
import { danteBridge } from "@/lib/dante-bridge";
import { DanteNeuronsResponseSchema } from "@/contracts/dante";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const neurons = await danteBridge.getNeurons();
    const parsed = DanteNeuronsResponseSchema.safeParse(neurons);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Respuesta inválida del puente." } },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "No fue posible obtener las neuronas." } },
      { status: 500 }
    );
  }
}
