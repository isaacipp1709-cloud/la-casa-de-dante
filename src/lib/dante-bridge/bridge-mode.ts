/**
 * Seleccion del modo de operacion del bridge.
 * El Core real (Dante-AI-Core) es el modo POR DEFECTO: si la variable no esta
 * configurada, nunca se sirve mock en produccion. El mock exige DANTE_MODE=mock.
 */
export function isCoreMode(env: Record<string, string | undefined> = process.env): boolean {
  return env.DANTE_MODE !== 'mock';
}
