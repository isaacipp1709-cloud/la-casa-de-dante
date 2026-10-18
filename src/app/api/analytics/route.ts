import { requireAuthorizedOwner } from '@/lib/auth/require-owner';
import { NextRequest, NextResponse } from "next/server";
import { danteBridge } from "@/lib/dante-bridge";
import { DanteAnalyticsSchema } from "@/contracts/dante";

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
