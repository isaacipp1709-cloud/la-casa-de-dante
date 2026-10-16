"use client";

import React, { useCallback, useEffect, useState } from "react";
import { KeyRound, Trash2, Plus, ShieldCheck } from "lucide-react";
import { BYOK_PROVIDERS, providerLabel } from "@/lib/credentials/provider-catalog";

/** Metadatos que devuelve el servidor: nunca incluye la clave. */
interface CredentialMetadata {
  credentialId: string;
  providerId: string;
  createdAt: string;
  status?: string;
}

type Tone = "ok" | "error";

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Tu sesion no esta autenticada. Inicia sesion para gestionar credenciales.",
  NOT_FOUND: "La credencial no existe o no te pertenece.",
  CONFIGURATION_ERROR: "Falta configuracion en el servidor para guardar credenciales.",
  INVALID_REQUEST: "Los datos enviados no son validos. Revisa el proveedor y la clave.",
  INTERNAL_ERROR: "El servidor no pudo completar la operacion.",
};

function messageFor(code: unknown, status: number): string {
  if (typeof code === "string" && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (status === 401) return ERROR_MESSAGES.UNAUTHORIZED;
  return "No se pudo completar la operacion.";
}

function shortId(credentialId: string): string {
  return credentialId.slice(0, 8);
}

function formatDate(value: string): string {
  if (!value) return "sin fecha";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "sin fecha";
  return parsed.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readCredentials(payload: unknown): CredentialMetadata[] {
  if (typeof payload !== "object" || payload === null) return [];
  const raw = (payload as { credentials?: unknown }).credentials;
  if (!Array.isArray(raw)) return [];

  const list: CredentialMetadata[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.credentialId !== "string" || typeof record.providerId !== "string") continue;
    list.push({
      credentialId: record.credentialId,
      providerId: record.providerId,
      createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
      status: typeof record.status === "string" ? record.status : undefined,
    });
  }
  return list;
}

/**
 * Gestion de credenciales BYOK: listar, crear y eliminar.
 * La clave se envia una sola vez y nunca se guarda en el estado ni se muestra.
 */
export function CredentialManager() {
  const [credentials, setCredentials] = useState<CredentialMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [providerId, setProviderId] = useState<string>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: Tone; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    setUnauthenticated(false);
    try {
      const response = await fetch("/api/credentials", { cache: "no-store" });
      if (response.status === 401) {
        setUnauthenticated(true);
        setCredentials([]);
        return;
      }
      if (!response.ok) {
        setListError("No se pudieron cargar tus credenciales.");
        setCredentials([]);
        return;
      }
      const payload: unknown = await response.json();
      setCredentials(readCredentials(payload));
    } catch {
      setListError("No se pudieron cargar tus credenciales.");
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = apiKey.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, apiKey: trimmed }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const code =
          typeof payload === "object" && payload !== null
            ? (payload as { error?: { code?: unknown } }).error?.code
            : undefined;
        setStatus({ tone: "error", text: messageFor(code, response.status) });
        return;
      }

      // La clave se descarta del formulario inmediatamente tras el alta.
      setApiKey("");

      const credential =
        typeof payload === "object" && payload !== null
          ? (payload as { credential?: { credentialId?: string; providerId?: string; createdAt?: string } }).credential
          : undefined;

      setStatus({
        tone: "ok",
        text:
          credential?.credentialId != null
            ? `Credencial guardada: ${providerLabel(String(credential.providerId ?? providerId))} · ${shortId(credential.credentialId)} · ${formatDate(String(credential.createdAt ?? ""))}`
            : "Credencial guardada.",
      });

      await load();
    } catch {
      setStatus({ tone: "error", text: "No se pudo guardar la credencial." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (credentialId: string) => {
    const confirmed = window.confirm(
      `¿Eliminar la credencial ${shortId(credentialId)}? Esta accion no se puede deshacer.`,
    );
    if (!confirmed) return;

    setDeletingId(credentialId);
    setStatus(null);
    try {
      const response = await fetch(`/api/credentials/${encodeURIComponent(credentialId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const code =
          typeof payload === "object" && payload !== null
            ? (payload as { error?: { code?: unknown } }).error?.code
            : undefined;
        setStatus({ tone: "error", text: messageFor(code, response.status) });
        return;
      }

      // Actualizacion local: no se recarga la aplicacion.
      setCredentials((previous) => previous.filter((item) => item.credentialId !== credentialId));
      setStatus({ tone: "ok", text: `Credencial ${shortId(credentialId)} eliminada.` });
    } catch {
      setStatus({ tone: "error", text: "No se pudo eliminar la credencial." });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-medium text-zinc-300">Credenciales propias (BYOK)</h2>
        </div>

        {unauthenticated ? (
          <p className="px-5 py-6 text-[13px] text-amber-400 font-mono">
            Inicia sesion para ver y gestionar tus credenciales.
          </p>
        ) : loading ? (
          <p className="px-5 py-6 text-[13px] text-zinc-600 font-mono animate-pulse">
            Cargando credenciales...
          </p>
        ) : listError ? (
          <p className="px-5 py-6 text-[13px] text-red-400 font-mono">{listError}</p>
        ) : credentials.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-zinc-600 font-mono">
            Todavia no tienes credenciales guardadas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                  <th className="text-left px-5 py-3">Proveedor</th>
                  <th className="text-left px-5 py-3">Creada</th>
                  <th className="text-left px-5 py-3">ID de credencial</th>
                  <th className="text-left px-5 py-3">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {credentials.map((credential, index) => (
                  <tr
                    key={credential.credentialId}
                    className={`${index < credentials.length - 1 ? "border-b border-zinc-800/60" : ""} hover:bg-zinc-800/40 transition-colors`}
                  >
                    <td className="px-5 py-3 font-medium text-zinc-200">
                      {providerLabel(credential.providerId)}
                    </td>
                    <td className="px-5 py-3 text-zinc-500 font-mono text-[13px]">
                      {formatDate(credential.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-zinc-400 font-mono text-[13px]">
                      {shortId(credential.credentialId)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border text-emerald-400 border-emerald-900 bg-emerald-900/20">
                        {credential.status ?? "active"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDelete(credential.credentialId)}
                        disabled={deletingId === credential.credentialId}
                        aria-label={`Eliminar credencial ${shortId(credential.credentialId)}`}
                        className="text-zinc-600 hover:text-red-400 disabled:opacity-40 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Agregar credencial
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label htmlFor="credential-provider" className="mb-1 text-[11px] font-mono text-zinc-500">
              Proveedor
            </label>
            <select
              id="credential-provider"
              value={providerId}
              onChange={(event) => setProviderId(event.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            >
              {BYOK_PROVIDERS.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                  {provider.adapterReady ? "" : " (sin adaptador todavia)"}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col flex-1 min-w-[220px]">
            <label htmlFor="credential-api-key" className="mb-1 text-[11px] font-mono text-zinc-500">
              API key
            </label>
            <input
              id="credential-api-key"
              name="apiKey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Se envia una sola vez y no se vuelve a mostrar"
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            />
          </div>

          <button
            type="submit"
            disabled={saving || apiKey.trim().length === 0}
            className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-100 text-sm px-5 py-2 rounded-md transition-colors"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>

        {status && (
          <p
            className={`mt-3 text-[11px] font-mono ${status.tone === "ok" ? "text-emerald-400" : "text-red-400"}`}
          >
            {status.text}
          </p>
        )}

        <p className="mt-3 text-[11px] text-zinc-600 font-mono flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          La clave se cifra en el servidor y nunca se devuelve al navegador. El chat usa solo el ID de credencial.
        </p>
      </div>
    </div>
  );
}
