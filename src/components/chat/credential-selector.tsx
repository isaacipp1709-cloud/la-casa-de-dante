"use client";

import { authorizedFetch } from "@/lib/auth/client-session";
import { useEffect, useRef, useState } from "react";

/** Vista publica de una credencial: solo metadatos, nunca la clave. */
export interface CredentialOption {
  credentialId: string;
  providerId: string;
  createdAt: string;
}

export interface CredentialSelectorProps {
  providerId: string | null;
  onCredentialChange: (credentialId: string | null) => void;
  disabled?: boolean;
}

const PROVIDER_LABEL: Record<string, string> = {
  gemini: "Gemini",
  deepseek: "DeepSeek",
  nvidia: "NVIDIA NIM",
  openrouter: "OpenRouter",
  groq: "Groq",
  ollama: "Ollama",
  huggingface: "Hugging Face",
  mock: "Mock",
};

type LoadState = "idle" | "loading" | "ready" | "unauthorized" | "error";

function labelFor(providerId: string): string {
  return PROVIDER_LABEL[providerId] ?? providerId;
}

function shortId(credentialId: string): string {
  return credentialId.slice(0, 8);
}

function formatDate(value: string): string {
  if (!value) return "sin fecha";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "sin fecha";
  return parsed.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Selector de credenciales propias del usuario autenticado.
 * Obtiene los metadatos desde GET /api/credentials y envia solo el credentialId.
 */
export function CredentialSelector({ providerId, onCredentialChange, disabled = false }: CredentialSelectorProps) {
  const [credentials, setCredentials] = useState<CredentialOption[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [state, setState] = useState<LoadState>("idle");

  const changeRef = useRef(onCredentialChange);
  useEffect(() => {
    changeRef.current = onCredentialChange;
  }, [onCredentialChange]);

  useEffect(() => {
    changeRef.current(selected ? selected : null);
  }, [selected]);

  useEffect(() => {
    if (!providerId) {
      setCredentials([]);
      setSelected("");
      setState("idle");
      return;
    }

    let cancelled = false;
    setState("loading");
    setSelected("");

    const load = async () => {
      try {
        const response = await authorizedFetch("/api/credentials", { cache: "no-store" });
        if (cancelled) return;

        if (response.status === 401) {
          setCredentials([]);
          setState("unauthorized");
          return;
        }
        if (!response.ok) {
          setCredentials([]);
          setState("error");
          return;
        }

        const data: unknown = await response.json();
        const rawList =
          typeof data === "object" && data !== null && Array.isArray((data as { credentials?: unknown }).credentials)
            ? ((data as { credentials: unknown[] }).credentials)
            : [];

        const list: CredentialOption[] = [];
        for (const entry of rawList) {
          if (typeof entry !== "object" || entry === null) continue;
          const record = entry as Record<string, unknown>;
          if (
            typeof record.credentialId === "string" &&
            typeof record.providerId === "string" &&
            record.providerId === providerId
          ) {
            list.push({
              credentialId: record.credentialId,
              providerId: record.providerId,
              createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
            });
          }
        }

        if (cancelled) return;
        setCredentials(list);
        setState("ready");
        if (list.length > 0) setSelected(list[0].credentialId);
      } catch {
        if (!cancelled) {
          setCredentials([]);
          setState("error");
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  if (!providerId) return null;

  const providerLabel = labelFor(providerId);

  return (
    <div className="w-full sm:w-auto mt-2 sm:mt-0">
      <label htmlFor="credential-select" className="mb-1 block text-xs font-mono text-zinc-400">
        Credencial
      </label>
      <select
        id="credential-select"
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        disabled={disabled || state === "loading" || credentials.length === 0}
        className="w-full sm:w-64 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600 disabled:opacity-50"
      >
        {credentials.length === 0 && <option value="">Sin credencial</option>}
        {credentials.map((credential) => (
          <option key={credential.credentialId} value={credential.credentialId}>
            {labelFor(credential.providerId)} · {formatDate(credential.createdAt)} · {shortId(credential.credentialId)}
          </option>
        ))}
        {credentials.length > 0 && <option value="">Sin credencial (usar configuracion del servidor)</option>}
      </select>

      {state === "loading" && (
        <p className="mt-1 text-[10px] font-mono text-zinc-500">Cargando credenciales...</p>
      )}
      {state === "ready" && credentials.length === 0 && (
        <p className="mt-1 text-[10px] font-mono text-amber-400">
          No tienes una clave de {providerLabel} guardada
        </p>
      )}
      {state === "unauthorized" && (
        <p className="mt-1 text-[10px] font-mono text-amber-400">
          Inicia sesion para usar una clave guardada
        </p>
      )}
      {state === "error" && (
        <p className="mt-1 text-[10px] font-mono text-red-400">
          No se pudieron cargar tus credenciales
        </p>
      )}
    </div>
  );
}
