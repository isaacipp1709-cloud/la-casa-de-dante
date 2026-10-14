import { NextResponse } from "next/server";
import { danteBridge } from "@/lib/dante-bridge";
import { DanteAnalyticsSchema } from "@/contracts/dante";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const analytics = await danteBridge.getAnalytics();
    const parsed = DanteAnalyticsSchema.safeParse(analytics);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Respuesta de analítica inválida." } },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "No fue posible obtener las métricas." } },
      { status: 500 }
    );
  }
}
