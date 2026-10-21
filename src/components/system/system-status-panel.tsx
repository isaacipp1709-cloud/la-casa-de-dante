"use client";

import { authorizedFetch } from "@/lib/auth/client-session";
import { useEffect, useState } from "react";
import { Server, Activity, Database, Radio, ShieldCheck, Loader, Brain } from "lucide-react";

type ConnStatus = "online" | "unstable" | "offline";

interface Connection {
  id: string;
  name: string;
  status: ConnStatus;
  details: string;
}

interface Analytics {
  totalConversations: number;
  totalMessages: number;
  averageLatencyMs: number;
}

interface ProviderInfo {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
}

interface NeuronInfo {
  id: string;
  status: "activo" | "en_espera" | "degradado";
}

const DOT: Record<ConnStatus, string> = {
  online: "bg-emerald-500",
  unstable: "bg-amber-500",
  offline: "bg-zinc-600",
};

const LABEL: Record<ConnStatus, string> = {
  online: "Operativo",
  unstable: "Inestable",
  offline: "Desconectado",
};

export function SystemStatusPanel() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [neurons, setNeurons] = useState<NeuronInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const [connRes, analyticsRes, provRes, neurRes] = await Promise.allSettled([
        authorizedFetch("/api/connections"),
        authorizedFetch("/api/analytics"),
        authorizedFetch("/api/providers"),
        authorizedFetch("/api/neurons"),
      ]);

      if (connRes.status === "fulfilled" && connRes.value.ok) {
        const data: Connection[] = await connRes.value.json();
        if (Array.isArray(data)) setConnections(data);
      }

      if (analyticsRes.status === "fulfilled" && analyticsRes.value.ok) {
        const data: Analytics = await analyticsRes.value.json();
        setAnalytics(data);
      }

      if (provRes.status === "fulfilled" && provRes.value.ok) {
        const data: ProviderInfo[] = await provRes.value.json();
        if (Array.isArray(data)) setProviders(data);
      }

      if (neurRes.status === "fulfilled" && neurRes.value.ok) {
        const data: NeuronInfo[] = await neurRes.value.json();
        if (Array.isArray(data)) setNeurons(data);
      }
    } catch {
      // Silently fail — panel shows last known state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, []);

  const coreConn = connections.find((c) => c.id === "dante-core");
  const zodConn = connections.find((c) => c.id === "dante-bridge-zod");
  const dbConn = connections.find((c) => c.id === "neon-db");
  const activeProviders = providers.filter((p) => p.is_active);
  const primaryProvider = activeProviders[0];
  const activeNeuronsCount = neurons.filter((n) => n.status === "activo").length;

  return (
    <aside
      className="hidden lg:block w-72 border-l border-zinc-900 bg-zinc-950 p-4 overflow-y-auto"
      aria-label="Estado del sistema"
    >
      <div className="flex items-center justify-between mb-4 mt-2 px-1">
        <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          Estado del sistema
        </h2>
        {loading && (
          <Loader className="w-3 h-3 text-zinc-600 animate-spin" />
        )}
      </div>
      <div className="space-y-3">
        {/* Núcleo conversacional */}
        <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
          <div className="flex items-center gap-2 mb-1 text-zinc-300">
            <Activity
              className={`w-3.5 h-3.5 ${
                coreConn?.status === "online"
                  ? "text-emerald-500"
                  : coreConn?.status === "unstable"
                  ? "text-amber-500"
                  : "text-zinc-600"
              }`}
            />
            <span className="text-[13px] font-medium">Núcleo conversacional</span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono ml-6 leading-relaxed">
            {loading
              ? "Conectando..."
              : coreConn
              ? `${LABEL[coreConn.status]} — ${coreConn.details}`
              : "Sin datos"}
          </p>
        </div>

        {/* Frontera Zod (dante-bridge) */}
        <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
          <div className="flex items-center gap-2 mb-1 text-zinc-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[13px] font-medium">Frontera Zod</span>
          </div>
          <div className="flex items-center gap-2 ml-6">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                zodConn ? DOT[zodConn.status] : "bg-emerald-500"
              }`}
            />
            <p className="text-[11px] text-zinc-500 font-mono leading-relaxed">
              {loading
                ? "..."
                : zodConn
                ? zodConn.details
                : "Validación z.safeParse() activa"}
            </p>
          </div>
        </div>

        {/* Matriz Cognitiva (37 Neuronas) */}
        <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
          <div className="flex items-center gap-2 mb-1 text-zinc-300">
            <Brain className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[13px] font-medium">Matriz Cognitiva</span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono ml-6 leading-relaxed">
            {loading
              ? "..."
              : neurons.length > 0
              ? `${activeNeuronsCount}/${neurons.length} neuronas activas`
              : "Sin datos"}
          </p>
        </div>

        {/* Proveedor activo */}
        <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
          <div className="flex items-center gap-2 mb-1 text-zinc-300">
            <Server className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[13px] font-medium">Proveedor activo</span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono ml-6 leading-relaxed">
            {loading
              ? "..."
              : primaryProvider
              ? `${primaryProvider.name} (${activeProviders.length} disp.)`
              : "Dante Cloud Core"}
          </p>
        </div>

        {/* Persistencia */}
        <div
          className={`p-3 rounded-lg border ${
            dbConn?.status === "online"
              ? "bg-zinc-900/40 border-zinc-800/50"
              : "bg-zinc-900/20 border-zinc-800/30 opacity-85"
          }`}
        >
          <div className="flex items-center gap-2 mb-1 text-zinc-400">
            <Database className="w-3.5 h-3.5" />
            <span className="text-[13px] font-medium">Persistencia</span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono ml-6 leading-relaxed">
            {loading
              ? "..."
              : dbConn
              ? `${LABEL[dbConn.status]} — ${dbConn.details}`
              : "No configurada"}
          </p>
        </div>

        {/* Telemetría */}
        <div
          className={`p-3 rounded-lg border ${
            analytics
              ? "bg-zinc-900/40 border-zinc-800/50"
              : "bg-zinc-900/20 border-zinc-800/30 opacity-70"
          }`}
        >
          <div className="flex items-center gap-2 mb-1 text-zinc-400">
            <Radio className="w-3.5 h-3.5" />
            <span className="text-[13px] font-medium">Telemetría</span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono ml-6 leading-relaxed">
            {loading
              ? "..."
              : analytics
              ? `${analytics.totalMessages} msg · ${analytics.averageLatencyMs}ms avg`
              : "Sin datos"}
          </p>
        </div>
      </div>
    </aside>
  );
}
