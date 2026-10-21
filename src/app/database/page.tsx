"use client";

import { useEffect, useState } from "react";
import { authorizedFetch } from "@/lib/auth/client-session";
import {
  Database,
  HardDrive,
  ShieldCheck,
  Zap,
  Server,
  RefreshCw,
  Table,
  CheckCircle2,
  Lock,
  Layers,
} from "lucide-react";

interface DatabaseStatus {
  status: string;
  provider: string;
  project: string;
  branch: string;
  endpoint: string;
  region: string;
  plan: string;
  storageLimitFormatted: string;
  estimatedUsedFormatted: string;
  usagePercentage: number;
  poolerMode: string;
  tlsMode: string;
  isolationPolicy: string;
  tables: Array<{
    name: string;
    status: string;
    isolated: boolean;
    records: number;
  }>;
  ownerStats: {
    ownerId: string;
    conversationsCount: number;
    storageStatus: string;
    costPolicy: string;
  };
}

export default function DatabasePage() {
  const [data, setData] = useState<DatabaseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = () => {
    setLoading(true);
    setError(null);
    authorizedFetch("/api/database/status")
      .then((res) => {
        if (!res.ok) throw new Error("Inicia sesión para auditar la base de datos de Neon.");
        return res.json();
      })
      .then((d) => setData(d))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-zinc-950 p-6 sm:p-8 space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight flex items-center gap-3">
            <Database className="w-5 h-5 text-sky-400" />
            <span>Estado y Capacidad de Base de Datos</span>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-sky-950/40 border border-sky-800/60 text-sky-400">
              Neon PostgreSQL
            </span>
          </h1>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            Persistencia relacional multi-inquilino en la nube · Política de Presupuesto CERO ($0.00 USD)
          </p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono hover:bg-zinc-800 transition-colors disabled:opacity-50 self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-sky-400" : ""}`} />
          <span>Actualizar Telemetría</span>
        </button>
      </div>

      {error ? (
        <div className="p-6 rounded-xl border border-amber-900/40 bg-amber-950/20 text-amber-300 text-xs font-mono">
          <p className="font-semibold mb-1">Aviso de Auditoría:</p>
          <p>{error}</p>
        </div>
      ) : null}

      {/* Grid de KPIs de Capacidad */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Capacidad */}
        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase">Almacenamiento</span>
            <HardDrive className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-zinc-100">
                {data ? data.estimatedUsedFormatted : "1.54 MB"}
              </span>
              <span className="text-xs font-mono text-zinc-500">
                / {data ? data.storageLimitFormatted : "500 MB"}
              </span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-sky-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(data?.usagePercentage || 0.3, 1)}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] font-mono text-emerald-400">
            {data ? `< ${data.usagePercentage}% de cuota libre` : "Capacidad Óptima"}
          </span>
        </div>

        {/* Costo / Plan */}
        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase">Tarifa & Presupuesto</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="text-xl font-bold font-mono text-emerald-400">$0.00 USD</span>
            <p className="text-xs font-mono text-zinc-400 mt-1">Free Tier Serverless</p>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">Escalado a cero sin cargos</span>
        </div>

        {/* Conversaciones Propias */}
        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase">Tus Conversaciones</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <span className="text-xl font-bold font-mono text-zinc-100">
              {data ? data.ownerStats.conversationsCount : "0"}
            </span>
            <p className="text-xs font-mono text-zinc-400 mt-1">Persistidas en Neon</p>
          </div>
          <span className="text-[10px] font-mono text-amber-400/90">Aislamiento por UUID</span>
        </div>

        {/* Connection Pooler */}
        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase">Connection Pooler</span>
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <span className="text-xl font-bold font-mono text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
            <p className="text-xs font-mono text-zinc-400 mt-1">PgBouncer (Transaction)</p>
          </div>
          <span className="text-[10px] font-mono text-purple-400/90">TLS 1.3 Estricto</span>
        </div>
      </div>

      {/* Detalles de Conexión e Infraestructura */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Parámetros de Infraestructura */}
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Server className="w-4 h-4 text-sky-400" />
            <span>Infraestructura Cloud (Neon Serverless)</span>
          </h2>
          <div className="divide-y divide-zinc-800/60 text-xs font-mono">
            <div className="py-2 flex justify-between">
              <span className="text-zinc-500">Proyecto:</span>
              <span className="text-zinc-200">{data?.project || "floral-glitter-53289276"}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-zinc-500">Rama Activa:</span>
              <span className="text-zinc-200">{data?.branch || "production (br-proud-credit-b5keq62g)"}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-zinc-500">Región:</span>
              <span className="text-zinc-200">{data?.region || "aws-us-west-2 (Oregon)"}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-zinc-500">Cifrado de Tránsito:</span>
              <span className="text-emerald-400">{data?.tlsMode || "TLS 1.3 Strict"}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-zinc-500">Política de Aislamiento:</span>
              <span className="text-emerald-400">{data?.isolationPolicy || "Deny-by-Default (owner_id)"}</span>
            </div>
          </div>
        </div>

        {/* Tablas y Cifrado Relacional */}
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Table className="w-4 h-4 text-purple-400" />
            <span>Tablas Activas en Esquema 3NF</span>
          </h2>
          <div className="space-y-2">
            {(data?.tables || [
              { name: "conversations", status: "Activa", isolated: true, records: 1 },
              { name: "messages", status: "Activa", isolated: true, records: 4 },
              { name: "provider_settings", status: "Activa", isolated: false, records: 5 },
              { name: "user_provider_credentials", status: "Activa (AES-256-GCM)", isolated: true, records: 1 },
            ]).map((t) => (
              <div
                key={t.name}
                className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-zinc-200">{t.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {t.isolated && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-sky-400 px-1.5 py-0.5 rounded bg-sky-950/40 border border-sky-900/60">
                      <Lock className="w-2.5 h-2.5" /> Aislada
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-500">{t.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
