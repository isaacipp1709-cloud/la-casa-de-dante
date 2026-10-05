import { NextResponse } from 'next/server';

const CORE_URL = process.env.DANTE_CORE_URL || 'http://localhost:3001';
const CORE_TOKEN = process.env.DANTE_CORE_TOKEN || '';

export async function GET() {
  try {
    const res = await fetch(`${CORE_URL}/api/providers/status`, {
      headers: { 'Authorization': `Bearer ${CORE_TOKEN}` }
    });
    
    if (!res.ok) {
       return NextResponse.json([
         { id: 'mock', name: 'Mock Fallback', category: 'mock', is_active: true }
       ]); // Fail-safe
    }
    
    const data = await res.json();
    return NextResponse.json(data.providers);
  } catch {
    return NextResponse.json([{ id: 'mock', name: 'Mock Fallback (Offline)', category: 'mock', is_active: true }]);
  }
}
// POST y DELETE eliminados ya que la configuración real ahora está
// dictada por las variables de entorno del Core.
