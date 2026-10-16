
import { NextRequest, NextResponse } from "next/server";
import { CredentialService } from "@/lib/services/credential-service";

export const dynamic = "force-dynamic";

// Auth checked by middleware/session; NEVER trust browser userId
function getAuthenticatedOwner(req: NextRequest): string | null {
  // Use server-side auth (Supabase session / JWT), not browser header
  const authHeader = req.headers.get('authorization') || '';
  // Validate server-side session token here
  // If no valid server session: return null (not a browser userId)
  if (!authHeader.startsWith('Bearer ')) return null;
  // In real implementation: validate JWT and extract user_id from verified claim
  return null; // Placeholder: requires server session config
}

export async function POST(req: NextRequest) {
  const owner = getAuthenticatedOwner(req);
  if (!owner) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Server authentication required. Do not send userId from browser." } },
      { status: 401 }
    );
  }
  
  const masterSecret = process.env.CREDENTIAL_MASTER_SECRET;
  if (!masterSecret) {
    return NextResponse.json(
      { error: { code: "CONFIGURATION_ERROR", message: "Configuration missing: CREDENTIAL_MASTER_SECRET not set." } },
      { status: 500 }
    );
  }
  
  try {
    const body = await req.json();
    const { providerId, apiKey, model } = body;
    
    if (!providerId || !apiKey) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "providerId and apiKey required." } },
        { status: 400 }
      );
    }
    
    const service = new CredentialService(masterSecret);
    const token = service.encrypt(apiKey, owner);
    
    // Return only masked identifier and provider info - NEVER return the key
    const identifier = service.getKeyIdentifier(token);
    
    return NextResponse.json({
      id: identifier.masked,
      providerId,
      model,
      ownerId: identifier.ownerId,
      saved: true,
      note: "Key is encrypted and isolated by owner. Not returned."
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to save credential." } },
      { status: 500 }
    );
  }
}
