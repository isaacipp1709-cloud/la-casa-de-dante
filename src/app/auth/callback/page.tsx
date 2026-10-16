"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import {
  createSingleFlight,
  describeCallbackFailure,
  exchangeOAuthCode,
  getBrowserAuthClient,
  isBrowserAuthConfigured,
  readOAuthCallbackParams,
} from "@/lib/auth/client-session";

/** Ruta interna fija y existente a la que se navega tras autenticar. */
const HOME_PATH = "/";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const flight = useRef<() => boolean>(createSingleFlight());

  useEffect(() => {
    // 1. Cliente inicializado de inmediato para poder completar el intercambio.
    getBrowserAuthClient();

    if (!isBrowserAuthConfigured()) {
      setMessage("La autenticacion no esta configurada en este entorno.");
      return;
    }

    // 2. Un solo intercambio, aunque el efecto se repita (StrictMode/recarga).
    if (!flight.current()) return;

    const params = readOAuthCallbackParams(window.location.search);

    // 3. Errores del proveedor o codigo ausente: se informa, nunca se redirige.
    const failure = describeCallbackFailure(params);
    if (failure) {
      setMessage(failure);
      return;
    }

    const code = String(params.code);

    // 4. Intercambio manual PKCE (el SDK no lo hace: detectSessionInUrl=false).
    void (async () => {
      const result = await exchangeOAuthCode(code);
      if (!result.ok) {
        setMessage(result.message ?? "No se pudo completar el acceso.");
        return;
      }

      // 5. Sesion ya establecida: se limpia la URL y se navega a ruta fija.
      window.history.replaceState({}, "", "/auth/callback");
      router.replace(HOME_PATH);
    })();
  }, [router]);

  return (
    <div className="flex min-h-full w-full items-center justify-center bg-zinc-950 p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 space-y-5 text-center">
        <h1 className="text-base font-semibold text-zinc-100 flex items-center justify-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          Completando el acceso
        </h1>

        {message ? (
          <>
            <p className="text-[12px] font-mono text-red-400">{message}</p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-white transition-colors"
            >
              Volver a intentar
            </Link>
          </>
        ) : (
          <p className="text-[12px] font-mono text-zinc-500 animate-pulse">
            Verificando la sesion con Supabase...
          </p>
        )}
      </div>
    </div>
  );
}
