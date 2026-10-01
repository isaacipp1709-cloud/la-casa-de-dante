import { NextResponse } from "next/server";
import { DanteHealthResponseSchema } from "@/contracts/dante";

export async function GET() {
  const healthData = {
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  };

  const parsed = DanteHealthResponseSchema.safeParse(healthData);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Health check validation failed" },
      { status: 500 }
    );
  }

  return NextResponse.json(parsed.data);
}
