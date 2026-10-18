"use client";

import { authorizedFetch } from "@/lib/auth/client-session";
import { useEffect, useState } from "react";
import { Signal, Wifi, WifiOff, FileText, ShieldCheck, Upload } from "lucide-react";
import { ConnectionsPanel } from "@/components/connections/connections-panel";

type ConnectionStatus = "online" | "unstable" | "offline";

interface Connection {
  id: string;
  name: string;
  status: ConnectionStatus;
  details: string;
}

interface IngestedDocument {
  id: string;
  title: string;
  category: "arquitectura" | "seguridad" | "memoria" | "general";
  chunksCount: number;
  charCount: number;
  ingestedAt: string;
  neuronHandler: string;
}

const ICONS: Record<ConnectionStatus, React.ComponentType<{ className?: string }>> = {
  online: Wifi,
  unstable: Signal,
  offline: WifiOff,
};

const STATUS_COLORS: Record<ConnectionStatus, { dot: string; text: string; border: string }> = {
  online: {
    dot: "bg-emerald-500",
    text: "text-emerald-400",
    border: "border-emerald-900/60",
  },
  unstable: {
    dot: "bg-amber-500",
    text: "text-amber-400",
    border: "border-amber-900/60",
  },
  offline: {
    dot: "bg-red-600",
    text: "text-red-400",
    border: "border-red-900/60",
  },
};

const LABEL: Record<ConnectionStatus, string> = {
  online: "Operativo",
  unstable: "Inestable",
  offline: "Desconectado",
};

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [documents, setDocuments] = useState<IngestedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"arquitectura" | "seguridad" | "memoria" | "general">("arquitectura");
  const [content, setContent] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchConnectionsAndDocs = async () => {
    try {
      const [connRes, docsRes] = await Promise.allSettled([
        authorizedFetch("/api/connections"),
        authorizedFetch("/api/connections?scope=documents"),
      ]);
      if (connRes.status === "fulfilled" && connRes.value.ok) {
        const data = await connRes.value.json();
        if (Array.isArray(data)) setConnections(data);
      }
      if (docsRes.status === "fulfilled" && docsRes.value.ok) {
        const docsData = await docsRes.value.json();
        if (Array.isArray(docsData)) setDocuments(docsData);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectionsAndDocs();
    const interval = setInterval(fetchConnectionsAndDocs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await authorizedFetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, content }),
      });

      if (!res.ok) {
        setFeedback("Rechazado por dante-bridge: verifica que el contenido tenga al menos 10 caracteres.");
      } else {
        const updatedDocs = await res.json();
        if (Array.isArray(updatedDocs)) setDocuments(updatedDocs);
        setTitle("");
        setContent("");
        setFeedback("Documento validado con z.safeParse() e ingerido por N26.");
      }
    } catch {
      setFeedback("No fue posible procesar el documento.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-zinc-950 p-6 sm:p-8 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100 tracking-tight flex items-center gap-3">
          <Signal className="w-5 h-5 text-emerald-400" /> Sistema, Frontera e Ingestión Semántica
        </h1>
        <p className="text-xs text-zinc-500 font-mono mt-1 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Cabeceras de seguridad HTTP activas · Deny-by-default</span>
        </p>
      </div>

      {/* Panel central de conexiones del sistema */}
      <ConnectionsPanel />

      {/* Conexiones activas */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-300">Conexiones activas</h2>
          <p className="text-[11px] text-zinc-600 font-mono mt-0.5">
            Actualiza cada 5 segundos
          </p>
        </div>

        {loading && connections.length === 0 ? (
          <div className="px-5 py-8 text-[13px] text-zinc-600 font-mono animate-pulse flex items-center gap-3">
            <div className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-transparent animate-spin" />
            Estableciendo enlace de telemetría…
          </div>
        ) : (
          <ul>
            {connections.map((conn, i) => {
              const colors = STATUS_COLORS[conn.status];
              const Icon = ICONS[conn.status];
              return (
                <li
                  key={conn.id}
                  className={`flex items-center justify-between px-5 py-4 ${
                    i < connections.length - 1 ? "border-b border-zinc-800/70" : ""
                  } transition-colors hover:bg-zinc-800/30`}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative flex items-center justify-center w-6 h-6">
                      <span
                        className={`absolute w-3.5 h-3.5 rounded-full ${colors.dot}`}
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-zinc-200">
                        {conn.name}
                      </h3>
                      <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                        {conn.details}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border bg-zinc-900 ${colors.text} ${colors.border}`}
                  >
                    <Icon className="w-3 h-3" />
                    {LABEL[conn.status]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Ingestor Semántico Documental (Neurona N26) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-400" />
                <span>Ingestor Semántico Documental (N26)</span>
              </h2>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                Validado con DanteDocumentIngestionRequestSchema.safeParse()
              </p>
            </div>
          </div>

          <form onSubmit={handleIngest} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título del documento o directiva"
                required
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
              />
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as "arquitectura" | "seguridad" | "memoria" | "general")
                }
                aria-label="Categoría documental"
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-zinc-600"
              >
                <option value="arquitectura">Arquitectura</option>
                <option value="seguridad">Seguridad</option>
                <option value="memoria">Memoria</option>
                <option value="general">General</option>
              </select>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Pega aquí el contenido técnico o especificación para indexación semántica local (mínimo 10 caracteres)..."
              rows={4}
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 resize-none"
            />

            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-mono text-zinc-500">
                {content.length} caracteres · $0 Tier Local
              </span>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs transition-colors disabled:opacity-50"
              >
                {submitting ? "Ingiriendo..." : "Ingerir en Memoria"}
              </button>
            </div>

            {feedback && (
              <p className="text-xs font-mono text-emerald-400 pt-1">{feedback}</p>
            )}
          </form>
        </div>

        {/* Documentos Ingeridos */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Corpus Semántico Activo</span>
            </h2>
            <span className="text-[11px] font-mono text-zinc-500">
              {documents.length} docs
            </span>
          </div>
          <div className="divide-y divide-zinc-800/70 overflow-y-auto max-h-72">
            {documents.map((doc) => (
              <div key={doc.id} className="px-5 py-3.5 hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-zinc-200 truncate">
                    {doc.title}
                  </h3>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-sky-400 shrink-0">
                    {doc.category}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[11px] font-mono text-zinc-500">
                  <span>
                    {doc.chunksCount} fragmentos · {doc.charCount} chars
                  </span>
                  <span>{doc.neuronHandler}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
