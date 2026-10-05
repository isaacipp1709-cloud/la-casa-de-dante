"use client";

import React, { useState, useEffect } from "react";
import { MessageSquare, BarChart2, Zap } from "lucide-react";

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

export default function Dashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const [convRes, analRes] = await Promise.allSettled([
          fetch("/api/conversations"),
          fetch("/api/analytics"),
        ]);
        if (convRes.status === "fulfilled" && convRes.value.ok) {
          const data = await convRes.value.json();
          if (Array.isArray(data)) setConversations(data);
        }
        if (analRes.status === "fulfilled" && analRes.value.ok) {
          const data: Analytics = await analRes.value.json();
          setAnalytics(data);
        }
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

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
  ];

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-zinc-950 p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-zinc-100 mb-6 tracking-tight">
        Casa — Visión general
      </h1>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
              <p className="text-2xl font-bold text-zinc-100">
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

      {/* Conversaciones recientes */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-300">
            Conversaciones recientes
          </h2>
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
                <span className="text-[13px] font-mono text-zinc-400 truncate max-w-xs">
                  {c.external_id || c.id}
                </span>
                <span className="text-[11px] text-zinc-600 font-mono shrink-0 ml-4">
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
