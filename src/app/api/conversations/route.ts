import { NextResponse } from 'next/server';

const CORE_URL = process.env.DANTE_CORE_URL || 'http://localhost:3001';

export async function GET() {
  try {
    const response = await fetch(`${CORE_URL}/api/conversations`, {
      headers: {
        'Authorization': `Bearer ${process.env.DANTE_CORE_TOKEN || ''}`,
      },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'BRIDGE_ERROR' }, { status: 500 });
  }
}
