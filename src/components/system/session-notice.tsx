"use client";

import React from "react";

/** Mensaje explicito de sesion; null si el estado no es de sesion. */
export function sessionMessageFor(status: number | null | undefined): string | null {
  if (status === 401) return "Inicia sesion para continuar.";
  if (status === 403) return "Tu identidad no esta autorizada para este panel.";
  return null;
}

export function SessionNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mb-4 rounded-lg border border-amber-900/60 bg-amber-950/20 px-4 py-2 text-[11px] font-mono text-amber-300">
      {message}
    </p>
  );
}
