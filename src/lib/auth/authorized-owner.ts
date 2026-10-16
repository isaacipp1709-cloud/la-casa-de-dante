/**
 * Autorizacion de usuarios de La Casa.
 *
 * Autenticarse (token valido) NO equivale a estar autorizado: solo las
 * identidades listadas explicitamente en DANTE_AUTHORIZED_OWNER_IDS entran.
 * Sin lista configurada NADIE esta autorizado y nunca se asigna admin al
 * primer usuario que se registre.
 */

export const AUTHORIZED_OWNERS_ENV = 'DANTE_AUTHORIZED_OWNER_IDS';

export function readAuthorizedOwners(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const raw = env[AUTHORIZED_OWNERS_ENV];
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function isAuthorizedOwner(
  ownerId: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (typeof ownerId !== 'string' || ownerId.length === 0) return false;
  return readAuthorizedOwners(env).includes(ownerId);
}
