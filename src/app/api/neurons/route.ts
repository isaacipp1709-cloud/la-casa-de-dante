import { NextResponse } from 'next/server';

const CORE_URL = process.env.DANTE_CORE_URL || 'http://localhost:3001';
const CORE_TOKEN = process.env.DANTE_CORE_TOKEN || '';

export async function GET() {
  try {
    const res = await fetch(`${CORE_URL}/api/neurons`, {
      headers: { 'Authorization': `Bearer ${CORE_TOKEN}` }
    });
    
    if (!res.ok) return NextResponse.json([]);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json([]);
  }
}
