import { NextResponse } from "next/server";
import { danteBridge } from "@/lib/dante-bridge";
import { DanteLogsResponseSchema } from "@/contracts/dante";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const logsData = await danteBridge.getLogs();
    const parsed = DanteLogsResponseSchema.safeParse(logsData);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Respuesta de bitácora inválida." } },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "No fue posible obtener la bitácora." } },
      { status: 500 }
    );
  }
}
