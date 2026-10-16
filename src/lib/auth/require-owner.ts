import { isAuthorizedOwner, readAuthorizedOwners } from './authorized-owner';
import { resolveOwnerFromRequest, type OwnerResolution } from './server-owner';

/**
 * Resolucion de identidad para las rutas de servidor de La Casa:
 * 1) verifica el token del usuario contra Supabase Auth;
 * 2) comprueba que la identidad este autorizada explicitamente.
 * La lista vacia cierra el acceso (deny-by-default), nunca lo abre.
 */
export async function requireAuthorizedOwner(
  request: Request,
  deps: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch } = {},
): Promise<OwnerResolution> {
  const env = deps.env ?? process.env;

  const resolution = await resolveOwnerFromRequest(request, {
    env,
    fetchImpl: deps.fetchImpl,
  });
  if (!resolution.ok) return resolution;

  if (!isAuthorizedOwner(resolution.ownerId, env)) {
    const configured = readAuthorizedOwners(env).length > 0;
    return {
      ok: false,
      status: 403,
      code: 'USER_NOT_AUTHORIZED',
      message: configured
        ? 'Tu identidad no esta autorizada para acceder a este panel.'
        : 'No hay usuarios autorizados configurados en el servidor.',
    };
  }

  return resolution;
}
