"use client";

import { useState } from "react";
import { ShieldCheck, LogIn } from "lucide-react";
import { isBrowserAuthConfigured, signInWithGitHub } from "@/lib/auth/client-session";

export default function LoginPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = isBrowserAuthConfigured();

  const handleSignIn = async () => {
    setBusy(true);
    setMessage(null);
    const result = await signInWithGitHub();
    if (!result.ok) setMessage(result.message ?? "No se pudo iniciar el acceso.");
    setBusy(false);
  };

  return (
    <div className="flex min-h-full w-full items-center justify-center bg-zinc-950 p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Acceso privado a La Casa de Dante
          </h1>
          <p className="text-xs font-mono text-zinc-500">
            Solo identidades autorizadas. El acceso usa GitHub a traves de Supabase Auth y no
            solicita permisos sobre repositorios.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleSignIn()}
          disabled={busy || !configured}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors"
        >
          <LogIn className="w-4 h-4" />
          {busy ? "Redirigiendo..." : "Continuar con GitHub"}
        </button>

        {!configured && (
          <p className="text-[11px] font-mono text-amber-400">
            Falta configurar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en este entorno.
          </p>
        )}
        {message && <p className="text-[11px] font-mono text-red-400">{message}</p>}

        <p className="text-[11px] font-mono text-zinc-600">
          Autenticarse no otorga acceso: el servidor comprueba tu identidad contra la lista de
          usuarios autorizados.
        </p>
      </div>
    </div>
  );
}
