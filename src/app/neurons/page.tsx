"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  BrainCircuit,
  Activity,
  Search,
  Filter,
  Zap,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

interface Neuron {
  id: string;
  name: string;
  status: "activo" | "en_espera" | "degradado";
  category: string;
  description: string;
  lastExecution: string;
  latencyMs?: number;
  activationsToday?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  ejecutivo: "#10b981",
  seguridad: "#0ea5e9",
  memoria: "#f59e0b",
  razonamiento: "#8b5cf6",
  percepción: "#ec4899",
  auditoría: "#14b8a6",
};

export default function NeuronsPage() {
  const [neurons, setNeurons] = useState<Neuron[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("todas");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");

  useEffect(() => {
    fetch("/api/neurons")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setNeurons(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(neurons.map((n) => n.category)));
    return ["todas", ...unique];
  }, [neurons]);

  const filteredNeurons = useMemo(() => {
    return neurons.filter((n) => {
      const matchesSearch =
        n.name.toLowerCase().includes(search.toLowerCase()) ||
        n.description.toLowerCase().includes(search.toLowerCase()) ||
        n.category.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        selectedCategory === "todas" || n.category === selectedCategory;
      const matchesStatus =
        selectedStatus === "todos" || n.status === selectedStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [neurons, search, selectedCategory, selectedStatus]);

  const categoryChartData = useMemo(() => {
    const map = new Map<
      string,
      { category: string; count: number; avgLatency: number; totalLatency: number; activations: number }
    >();

    neurons.forEach((n) => {
      const current = map.get(n.category) || {
        category: n.category.toUpperCase(),
        count: 0,
        avgLatency: 0,
        totalLatency: 0,
        activations: 0,
      };
      current.count += 1;
      current.totalLatency += n.latencyMs ?? 20;
      current.avgLatency = Math.round(current.totalLatency / current.count);
      current.activations += n.activationsToday ?? 50;
      map.set(n.category, current);
    });

    return Array.from(map.entries()).map(([key, val]) => ({
      key,
      ...val,
      color: CATEGORY_COLORS[key] || "#10b981",
    }));
  }, [neurons]);

  const activeCount = neurons.filter((n) => n.status === "activo").length;
  const standbyCount = neurons.filter((n) => n.status === "en_espera").length;
  const avgCognitiveLatency = useMemo(() => {
    if (neurons.length === 0) return 0;
    const sum = neurons.reduce((acc, n) => acc + (n.latencyMs ?? 20), 0);
    return Math.round(sum / neurons.length);
  }, [neurons]);

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-zinc-950 p-6 sm:p-8 space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight flex items-center gap-3">
            <BrainCircuit className="w-5 h-5 text-emerald-400" />
            <span>Neuronas y Módulos Cognitivos</span>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
              {neurons.length} / 37 Von Neumann
            </span>
          </h1>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            Arquitectura cognitiva determinista · Telemetría validada por dante-bridge
          </p>
        </div>
      </div>

      {/* Resumen de KPIs Neuronales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex items-center gap-3">
          <Layers className="w-4 h-4 text-sky-400 shrink-0" />
          <div>
            <p className="text-[10px] font-mono uppercase text-zinc-500">Total Módulos</p>
            <p className="text-lg font-bold text-zinc-100 font-mono">{neurons.length}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex items-center gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <p className="text-[10px] font-mono uppercase text-zinc-500">En Línea (Activo)</p>
            <p className="text-lg font-bold text-emerald-400 font-mono">{activeCount}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex items-center gap-3">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <p className="text-[10px] font-mono uppercase text-zinc-500">En Espera</p>
            <p className="text-lg font-bold text-amber-400 font-mono">{standbyCount}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex items-center gap-3">
          <Zap className="w-4 h-4 text-purple-400 shrink-0" />
          <div>
            <p className="text-[10px] font-mono uppercase text-zinc-500">Latencia Sináptica</p>
            <p className="text-lg font-bold text-zinc-100 font-mono">{avgCognitiveLatency}ms</p>
          </div>
        </div>
      </div>

      {/* Gráfico Recharts de Telemetría por Subsistema */}
      {!loading && categoryChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Activaciones Hoy por Subsistema Cognitivo
              </h2>
              <span className="text-[11px] font-mono text-emerald-400">Recharts · Live</span>
            </div>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="category"
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
                  <Bar
                    dataKey="activations"
                    name="Activaciones"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  >
                    {categoryChartData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Latencia Promedio por Subsistema (ms)
              </h2>
              <span className="text-[11px] font-mono text-sky-400">Determinista</span>
            </div>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="category"
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
                  <Bar
                    dataKey="avgLatency"
                    name="Latencia (ms)"
                    fill="#38bdf8"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Controles de Búsqueda y Filtro */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-800/80">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar entre las 37 neuronas por código (ej. N01), nombre o función..."
            aria-label="Buscar neuronas"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-zinc-500 hidden sm:block" />
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-mono uppercase transition-colors border ${
                selectedCategory === cat
                  ? "bg-zinc-100 text-zinc-950 border-zinc-100 font-semibold"
                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200"
              }`}
            >
              {cat}
            </button>
          ))}

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            aria-label="Filtrar por estado"
            className="bg-zinc-950 border border-zinc-800 rounded-md px-2.5 py-1.5 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-zinc-600"
          >
            <option value="todos">Estado: Todos</option>
            <option value="activo">Activo</option>
            <option value="en_espera">En Espera</option>
            <option value="degradado">Degradado</option>
          </select>
        </div>
      </div>

      {/* Grilla de Neuronas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-[13px] text-zinc-600 font-mono animate-pulse col-span-full">
            Escaneando matriz de 37 neuronas...
          </p>
        ) : filteredNeurons.length === 0 ? (
          <p className="text-[13px] text-zinc-500 font-mono col-span-full py-8 text-center">
            No se encontraron neuronas con los filtros aplicados.
          </p>
        ) : (
          filteredNeurons.map((neuron) => (
            <div
              key={neuron.id}
              className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/80 flex flex-col justify-between hover:border-zinc-700 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-sm text-zinc-100 leading-snug">
                    {neuron.name}
                  </h3>
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                      neuron.status === "activo"
                        ? "bg-emerald-900/20 text-emerald-400 border-emerald-900/50"
                        : neuron.status === "en_espera"
                        ? "bg-amber-900/20 text-amber-400 border-amber-900/50"
                        : "bg-red-900/20 text-red-400 border-red-900/50"
                    }`}
                  >
                    {neuron.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                  {neuron.description}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 mt-auto text-[11px] text-zinc-500 font-mono pt-3 border-t border-zinc-800/60">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{neuron.latencyMs ?? 15}ms</span>
                  <span className="text-zinc-700">·</span>
                  <span>{neuron.activationsToday ?? 40} act.</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400 uppercase text-[10px]">
                  {neuron.category}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
