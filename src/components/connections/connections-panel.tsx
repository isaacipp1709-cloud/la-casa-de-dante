"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, KeyRound, Plug, RefreshCw, ShieldCheck } from "lucide-react";
import type { CasaConnection, ConnectionsPanel } from "@/contracts/connections";

const STATUS_LABEL: Record<CasaConnection["status"], string> = {
  active: "Activa",
  incomplete: "Incompleta",
  disabled: "Desactivada",
  not_configured: "No configurada",
};

const STATUS_STYLE: Record<CasaConnection["status"], string> = {
  active: "text-emerald-400 border-emerald-900 bg-emerald-900/20",
  incomplete: "text-amber-400 border-amber-900 bg-amber-900/20",
  disabled: "text-zinc-400 border-zinc-700 bg-zinc-800/60",
  not_configured: "text-red-400 border-red-900/70 bg-red-900/20",
};

const TYPE_LABEL: Record<CasaConnection["type"], string> = {
  database: "Base de datos",
  auth: "Autenticacion",
  ai_provider: "Proveedor de IA",
  bridge: "Bridge",
  integration: "Integracion",
};

const CREDENTIAL_LABEL: Record<CasaConnection["credentialSource"], string> = {
  system: "Credencial del sistema",
  byok: "Credencial BYOK",
  both: "Sistema + BYOK",
  none: "Sin credencial",
};

function byokHref(connectionId: string): string {
  return `/dashboard/providers#credencial-${connectionId.replace(/^ai\./, "")}`;
}

export function ConnectionsPanel() {
  const [panel, setPanel] = useState<ConnectionsPanel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/connections/status", { cache: "no-store" });
      if (!response.ok) {
        setError("No fue posible consultar el estado de conexiones.");
        return;
      }
      const payload = (await response.json()) as ConnectionsPanel;
      setPanel(payload);
    } catch {
      setError("No fue posible consultar el estado de conexiones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (connection: CasaConnection) => {
    if (!connection.canToggle) return;
    const providerId = connection.id.replace(/^ai\./, "");
    const enabled = connection.status === "disabled";
    setBusyId(connection.id);
    setFeedback(null);
    try {
      const response = await fetch("/api/connections/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, enabled }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null
            ? (payload as { error?: { message?: string } }).error?.message
            : undefined;
        setFeedback(message ?? "No se pudo cambiar el estado del proveedor.");
        return;
      }
      setPanel(payload as ConnectionsPanel);
      setFeedback(enabled ? "Proveedor activado." : "Proveedor desactivado. Su credencial se conserva.");
    } catch {
      setFeedback("No se pudo cambiar el estado del proveedor.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Plug className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-medium text-zinc-300">Conexiones del sistema</h2>
        </div>
        <div className="flex items-center gap-2">
          {panel && (
            <span
              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                panel.storage === "durable"
                  ? "text-emerald-400 border-emerald-900 bg-emerald-900/20"
                  : "text-amber-400 border-amber-900 bg-amber-900/20"
              }`}
            >
              {panel.storage === "durable" ? "Estado durable" : "Estado temporal"}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Actualizar conexiones"
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Actualizar
          </button>
        </div>
      </div>

      {loading && !panel && (
        <p className="px-5 py-6 text-[13px] text-zinc-600 font-mono animate-pulse">Consultando conexiones...</p>
      )}

      {error && <p className="px-5 py-6 text-[13px] text-red-400 font-mono">{error}</p>}

      {panel && (
        <>
          {!panel.bridge.reachable && (
            <p className="px-5 py-3 text-[12px] font-mono text-amber-400 border-b border-zinc-800 bg-amber-950/20 flex items-center gap-2">
              <Boxes className="w-3.5 h-3.5" />
              {panel.bridge.error ?? "Bridge no disponible."}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                  <th className="text-left px-5 py-3">Conexion</th>
                  <th className="text-left px-5 py-3">Tipo</th>
                  <th className="text-left px-5 py-3">Estado</th>
                  <th className="text-left px-5 py-3">Credencial</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {panel.connections.map((connection, index) => (
                  <tr
                    key={connection.id}
                    className={`${index < panel.connections.length - 1 ? "border-b border-zinc-800/60" : ""} hover:bg-zinc-800/40 transition-colors`}
                  >
                    <td className="px-5 py-3">
                      <div className="font-medium text-zinc-200">{connection.name}</div>
                      {connection.detail && (
                        <div className="text-[11px] font-mono text-zinc-500 mt-0.5">{connection.detail}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-zinc-500 font-mono text-[12px]">
                      {TYPE_LABEL[connection.type]}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLE[connection.status]}`}>
                        {STATUS_LABEL[connection.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-400 font-mono text-[11px]">
                      <span className="inline-flex items-center gap-1">
                        <KeyRound className="w-3 h-3" />
                        {CREDENTIAL_LABEL[connection.credentialSource]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {connection.type === "ai_provider" && (
                          <Link
                            href={byokHref(connection.id)}
                            className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300"
                          >
                            Credencial
                          </Link>
                        )}
                        {connection.canToggle && (
                          <button
                            type="button"
                            onClick={() => void toggle(connection)}
                            disabled={busyId === connection.id}
                            className="text-[10px] font-mono px-2 py-1 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                          >
                            {connection.status === "disabled" ? "Activar" : "Desactivar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {feedback && (
            <p className="px-5 py-3 text-[11px] font-mono text-zinc-300 border-t border-zinc-800">{feedback}</p>
          )}

          <p className="px-5 py-3 text-[11px] text-zinc-600 font-mono border-t border-zinc-800 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Solo se muestra estado y metadatos. Nunca claves, tokens ni URLs internas.
          </p>
        </>
      )}
    </div>
  );
}
