"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { MessageSquare, BarChart2, Zap, Brain, ShieldCheck, ArrowUpRight } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";

interface Conversation {
  id: string;
  external_id?: string;
  updated_at: string;
}

interface Analytics {
  totalConversations: number;
  totalMessages: number;
  averageLatencyMs: number;
}

interface ProviderStatus {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  usageToday: number;
  dailyLimit: number;
}

interface NeuronItem {
  id: string;
  category: string;
  status: string;
  latencyMs?: number;
  activationsToday?: number;
}

export default function Dashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [neurons, setNeurons] = useState<NeuronItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const [convRes, analRes, provRes, neurRes] = await Promise.allSettled([
          fetch("/api/conversations"),
          fetch("/api/analytics"),
          fetch("/api/providers"),
          fetch("/api/neurons"),
        ]);
        if (convRes.status === "fulfilled" && convRes.value.ok) {
          const data = await convRes.value.json();
          if (Array.isArray(data)) setConversations(data);
        }
        if (analRes.status === "fulfilled" && analRes.value.ok) {
          const data: Analytics = await analRes.value.json();
          setAnalytics(data);
        }
        if (provRes.status === "fulfilled" && provRes.value.ok) {
          const data: ProviderStatus[] = await provRes.value.json();
          if (Array.isArray(data)) setProviders(data);
        }
        if (neurRes.status === "fulfilled" && neurRes.value.ok) {
          const data: NeuronItem[] = await neurRes.value.json();
          if (Array.isArray(data)) setNeurons(data);
        }
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const activeNeuronsCount = useMemo(
    () => neurons.filter((n) => n.status === "activo").length,
    [neurons]
  );

  const subsystemTelemetry = useMemo(() => {
    const map = new Map<string, { subsystem: string; activations: number; avgLatency: number; count: number }>();
    neurons.forEach((n) => {
      const curr = map.get(n.category) || {
        subsystem: n.category.toUpperCase(),
        activations: 0,
        avgLatency: 0,
        count: 0,
      };
      curr.count += 1;
      curr.activations += n.activationsToday ?? 40;
      curr.avgLatency = Math.round(
        (curr.avgLatency * (curr.count - 1) + (n.latencyMs ?? 20)) / curr.count
      );
      map.set(n.category, curr);
    });
    return Array.from(map.values());
  }, [neurons]);

  const providerChartData = useMemo(
    () =>
      providers.map((p) => ({
        name: p.name.split(" ")[0],
        usage: p.usageToday,
        category: p.category,
      })),
    [providers]
  );

  const cards = [
    {
      label: "Conversaciones",
      value: analytics?.totalConversations ?? "—",
      icon: MessageSquare,
      color: "text-emerald-400",
    },
    {
      label: "Mensajes totales",
      value: analytics?.totalMessages ?? "—",
      icon: BarChart2,
      color: "text-sky-400",
    },
    {
      label: "Latencia promedio",
      value: analytics ? `${analytics.averageLatencyMs}ms` : "—",
      icon: Zap,
      color: "text-amber-400",
    },
    {
      label: "Matriz Neuronal",
      value: neurons.length > 0 ? `${activeNeuronsCount}/${neurons.length}` : "—",
      icon: Brain,
      color: "text-purple-400",
    },
  ];

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-zinc-950 p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">
            Casa — Visión general y Telemetría
          </h1>
          <p className="text-xs text-zinc-500 font-mono mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Centro de mando determinista · Costo operativo $0.00</span>
          </p>
        </div>
        <Link
          href="/neurons"
          className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700 transition-colors self-start"
        >
          <span>Explorar 37 Neuronas</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-start gap-4"
          >
            <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${color}`} />
            <div>
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono mb-1">
                {label}
              </p>
              <p className="text-2xl font-bold text-zinc-100 font-mono">
                {loading ? (
                  <span className="text-zinc-600 text-base animate-pulse">
                    cargando…
                  </span>
                ) : (
                  value
                )}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Gráficos de Telemetría con Recharts */}
      {!loading && subsystemTelemetry.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Actividad Cognitiva por Subsistema
              </h2>
              <span className="text-[11px] font-mono text-emerald-400">37 Neuronas</span>
            </div>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={subsystemTelemetry} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="subsystem"
                    tick={{ fill: "#a1a1aa", fontSize: 10, fontFamily: "monospace" }}
                    axisLine={{ stroke: "#3f3f46" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 10, fontFamily: "monospace" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#09090b",
                      borderColor: "#27272a",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#f4f4f5",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="activations"
                    name="Activaciones"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Solicitudes Diarias por Proveedor ($0 Tier)
              </h2>
              <span className="text-[11px] font-mono text-sky-400">Cuotas Protegidas</span>
            </div>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={providerChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#a1a1aa", fontSize: 10, fontFamily: "monospace" }}
                    axisLine={{ stroke: "#3f3f46" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 10, fontFamily: "monospace" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#09090b",
                      borderColor: "#27272a",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#f4f4f5",
                    }}
                  />
                  <Bar dataKey="usage" name="Uso hoy" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Conversaciones recientes */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-300">
            Conversaciones recientes
          </h2>
          <Link
            href="/"
            className="text-xs font-mono text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Ir al Chat →
          </Link>
        </div>
        {loading ? (
          <p className="px-5 py-6 text-[13px] text-zinc-600 font-mono animate-pulse">
            Cargando historial…
          </p>
        ) : conversations.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-zinc-600 font-mono">
            Sin conversaciones registradas todavía.
          </p>
        ) : (
          <ul>
            {conversations.map((c, i) => (
              <li
                key={c.id}
                className={`flex items-center justify-between px-5 py-3 ${
                  i < conversations.length - 1 ? "border-b border-zinc-800/70" : ""
                } hover:bg-zinc-800/40 transition-colors`}
              >
                <span className="text-[13px] font-mono text-zinc-300 truncate max-w-md">
                  {c.external_id || c.id}
                </span>
                <span className="text-[11px] text-zinc-500 font-mono shrink-0 ml-4">
                  {new Date(c.updated_at).toLocaleString("es-CL", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
