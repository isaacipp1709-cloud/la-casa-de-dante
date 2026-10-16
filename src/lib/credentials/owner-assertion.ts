import crypto from 'node:crypto';

/**
 * La Casa firma la identidad del usuario final para el Core.
 * Se reutiliza el secreto del bridge (DANTE_CORE_TOKEN): no se agregan secretos.
 * El Core valida la firma antes de aceptar cualquier ownerId.
 */

export const OWNER_ASSERTION_HEADER = 'x-dante-owner-assertion';
export const OWNER_ASSERTION_TTL_MS = 60_000;

export interface OwnerAssertionPayload {
  ownerId: string;
  iat: number;
  exp: number;
}

export class OwnerAssertionConfigurationError extends Error {
  constructor(message = 'DANTE_CORE_TOKEN is not configured') {
    super(message);
    this.name = 'OwnerAssertionConfigurationError';
  }
}

function toBase64Url(value: Buffer): string {
  return value.toString('base64url');
}

/** Devuelve la asercion firmada o null si no hay secreto configurado. */
export function signOwnerAssertion(
  ownerId: string,
  options: { secret?: string; ttlMs?: number; now?: number } = {},
): string | null {
  const secret = options.secret ?? process.env.DANTE_CORE_TOKEN;
  if (typeof secret !== 'string' || secret.length === 0) return null;
  if (typeof ownerId !== 'string' || ownerId.length === 0) return null;

  const now = options.now ?? Date.now();
  const payload: OwnerAssertionPayload = {
    ownerId,
    iat: now,
    exp: now + (options.ttlMs ?? OWNER_ASSERTION_TTL_MS),
  };

  const segment = toBase64Url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const signature = toBase64Url(crypto.createHmac('sha256', secret).update(segment).digest());
  return `${segment}.${signature}`;
}

/** Cabecera lista para el Core; vacia si no hay identidad o secreto. */
export function ownerAssertionHeaders(ownerId: string | null | undefined): Record<string, string> {
  if (!ownerId) return {};
  const assertion = signOwnerAssertion(ownerId);
  return assertion ? { [OWNER_ASSERTION_HEADER]: assertion } : {};
}
