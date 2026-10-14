import { NextResponse } from "next/server";
import { danteBridge } from "@/lib/dante-bridge";
import { DanteHealthResponseSchema } from "@/contracts/dante";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const healthData = await danteBridge.getHealth();
    const parsed = DanteHealthResponseSchema.safeParse(healthData);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Health check validation failed" } },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Health check failed" } },
      { status: 500 }
    );
  }
}
