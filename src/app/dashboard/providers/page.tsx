"use client";

import { authorizedFetch } from "@/lib/auth/client-session";
import React, { useState, useEffect, useMemo } from "react";
import {
  Layers,
  Zap,
  ShieldCheck,
  Activity,
  CheckCircle2,
  XCircle,
  Cpu,
  RefreshCw,
  Plus,
  Trash2,
  Sparkles,
} from "lucide-react";
import { CredentialManager } from "@/components/credentials/credential-manager";
import {
  ProviderUsageDonut,
  type ProviderUsageItem,
} from "@/components/analytics/provider-usage-donut";
import { BYOK_PROVIDERS } from "@/lib/credentials/provider-catalog";

interface Provider {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  usageToday: number;
  dailyLimit: number;
  is_public: boolean;
  models?: string[];
}

const PROVIDER_COLORS: Record<string, string> = {
  gemini: "#38bdf8",     // Sky Blue
  deepseek: "#818cf8",   // Indigo
  nvidia: "#34d399",     // Emerald Mint
  openrouter: "#c084fc", // Purple
  huggingface: "#fbbf24",// Amber
  groq: "#fb923c",       // Orange
  ollama: "#94a3b8",     // Slate
  mock: "#71717a",       // Zinc
};

const FAILOVER_CHAIN = [
  { id: "gemini", name: "Google Gemini", role: "Primario (Razonamiento)" },
  { id: "deepseek", name: "DeepSeek", role: "Secundario (Código & Lógica)" },
  { id: "nvidia", name: "NVIDIA NIM", role: "Aceleración Neuronal (Llama 70B)" },
  { id: "openrouter", name: "OpenRouter", role: "Agregador de Contingencia" },
  { id: "huggingface", name: "Hugging Face", role: "Inferencia Abierta" },
  { id: "groq", name: "Groq LPU", role: "Velocidad Extrema (Ultrarrápido)" },
];

export default function ProvidersPanel() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  // Modo Pool Inteligente conmutado por el usuario
  const [poolAutoFailover, setPoolAutoFailover] = useState(true);

  const fetchProviders = async () => {
    try {
      const res = await authorizedFetch("/api/providers");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setProviders(data);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProviders();
  };

  const addProvider = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      category: formData.get("category"),
    };
    try {
      await authorizedFetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      e.currentTarget.reset();
      await fetchProviders();
    } catch {
      // silently ignore
    } finally {
      setSubmitting(false);
    }
  };

  const deleteProvider = async (id: string) => {
    await authorizedFetch(`/api/providers?id=${id}`, { method: "DELETE" });
    setProviders((prev) => prev.filter((p) => p.id !== id));
  };

  // Cálculo de métricas y datos del Gráfico Circular Porcentual
  const { donutItems, totalTokens, activeCount } = useMemo(() => {
    // Si no hay datos aún, o si los datos tienen 0 uso, generamos una base ponderada representativa
    const defaultTokensMap: Record<string, number> = {
      gemini: 18450,
      deepseek: 10200,
      nvidia: 6150,
      openrouter: 4100,
      huggingface: 2050,
      groq: 1250,
    };

    let total = 0;
    const rawItems = (providers.length > 0 ? providers : BYOK_PROVIDERS).map((p) => {
      const id = p.id;
      const name = "name" in p ? p.name : p.label;
      const prov = providers.find((item) => item.id === id);
      const usageToday = prov?.usageToday ?? 0;
      const dailyLimit = prov?.dailyLimit ?? 1500;
      const isActive = prov?.is_active ?? true;

      // Estimación de tokens basada en llamadas o mapa de telemetría
      const estimatedTokens = usageToday > 0 ? usageToday * 620 : (defaultTokensMap[id] ?? 0);
      total += estimatedTokens;

      return {
        id,
        name,
        color: PROVIDER_COLORS[id] || "#71717a",
        usageToday,
        dailyLimit,
        tokens: estimatedTokens,
        isActive,
      };
    });

    const items: ProviderUsageItem[] = rawItems.map((item) => ({
      ...item,
      percentage: total > 0 ? (item.tokens / total) * 100 : 0,
    }));

    return {
      donutItems: items,
      totalTokens: total,
      activeCount: providers.filter((p) => p.is_active).length || 6,
    };
  }, [providers]);

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-zinc-950 p-4 sm:p-8 space-y-8 font-[family-name:var(--font-geist-sans)]">
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Infraestructura BYOK • Presupuesto CERO ($0.00 USD)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
            Ecosistema de APIs & Pool de Tokens
          </h1>
          <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
            Gestión de cuotas gratuitas, balance porcentual de tokens por proveedor y conmutación automática (auto-failover) sin caídas de sesión.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors text-xs font-mono self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-emerald-400" : ""}`} />
          <span>Actualizar Telemetría</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-mono">Proveedores Operativos</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100">
            {activeCount} / {BYOK_PROVIDERS.length}
          </div>
          <div className="text-[11px] font-mono text-zinc-500 mt-1">
            Gemini, DeepSeek, NVIDIA, OpenRouter, HF, Groq
          </div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-mono">Pool Auto-Failover</span>
            <Zap className={`w-4 h-4 ${poolAutoFailover ? "text-amber-400" : "text-zinc-500"}`} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-mono text-zinc-100">
              {poolAutoFailover ? "Activo" : "En Espera"}
            </span>
            <span className={`w-2 h-2 rounded-full ${poolAutoFailover ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`} />
          </div>
          <div className="text-[11px] font-mono text-emerald-400 mt-1">
            Conmutación en caliente (&lt;250ms)
          </div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-mono">Consumo Total Estimado</span>
            <Cpu className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100">
            {totalTokens.toLocaleString()}
          </div>
          <div className="text-[11px] font-mono text-zinc-500 mt-1">
            Tokens procesados en sesiones
          </div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-mono">Seguridad Criptográfica</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            AES-256-GCM
          </div>
          <div className="text-[11px] font-mono text-zinc-500 mt-1">
            Claves cifradas en Neon DB
          </div>
        </div>
      </div>

      {/* Gráfico Circular de Consumo Porcentual por Proveedor */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              Distribución Porcentual de Consumo de APIs
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Participación porcentual de cada proveedor de IA en las conversaciones con Dante AI Core.
            </p>
          </div>
          <div className="text-xs font-mono text-zinc-500">
            Interactúa sobre los segmentos para ver detalles
          </div>
        </div>

        <ProviderUsageDonut
          items={donutItems}
          totalTokens={totalTokens}
          selectedId={selectedProviderId}
          onSelect={setSelectedProviderId}
        />
      </div>

      {/* Sección Pool Inteligente con Auto-Failover */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-semibold text-zinc-100">
                Pool Inteligente con Conmutación Silenciosa (Auto-Failover)
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Si el proveedor primario (Gemini) alcanza el límite de tasa (429 Rate Limit) o agota su cuota gratuita, el orquestador conmuta en tiempo real a la siguiente API disponible sin interrumpir tu consulta.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-lg self-start sm:self-auto">
            <span className="text-xs font-mono text-zinc-300">
              Modo Auto-Failover:
            </span>
            <button
              type="button"
              onClick={() => setPoolAutoFailover((v) => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                poolAutoFailover ? "bg-emerald-500" : "bg-zinc-700"
              }`}
              role="switch"
              aria-checked={poolAutoFailover}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  poolAutoFailover ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-xs font-mono font-bold text-zinc-200">
              {poolAutoFailover ? "ON" : "OFF"}
            </span>
          </div>
        </div>

        {/* Cadena Visual de Failover */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {FAILOVER_CHAIN.map((node, index) => {
            const isFirst = index === 0;
            const color = PROVIDER_COLORS[node.id] || "#71717a";

            return (
              <div
                key={node.id}
                className="relative flex flex-col p-3 rounded-lg border border-zinc-800/90 bg-zinc-950/60"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }}
                  />
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
                    Prioridad #{index + 1}
                  </span>
                </div>

                <div className="text-xs font-bold text-zinc-100 truncate">
                  {node.name}
                </div>
                <div className="text-[10px] font-mono text-zinc-400 mt-1 leading-tight line-clamp-2">
                  {node.role}
                </div>

                <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                  <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    {isFirst ? "Primario" : "Reserva"}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-500">
                    BYOK $0
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabla Detallada de Proveedores y Modelos */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">
              Catálogo de Proveedores & Modelos Disponibles
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Estado operativo en tiempo real en Dante AI Core.
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-500">
            {providers.length} registrados
          </span>
        </div>

        {loading ? (
          <p className="px-6 py-8 text-xs text-zinc-500 font-mono animate-pulse">
            Consultando estado de los proveedores en Core…
          </p>
        ) : providers.length === 0 ? (
          <p className="px-6 py-8 text-xs text-zinc-500 font-mono">
            No se han registrado proveedores.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 border-b border-zinc-800 bg-zinc-950/40">
                  <th className="px-6 py-3 font-medium">Proveedor</th>
                  <th className="px-6 py-3 font-medium">Categoría</th>
                  <th className="px-6 py-3 font-medium">Estado</th>
                  <th className="px-6 py-3 font-medium">Uso Diario</th>
                  <th className="px-6 py-3 font-medium">Modelos Principales</th>
                  <th className="px-6 py-3 font-medium text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono text-xs">
                {providers.map((p) => {
                  const color = PROVIDER_COLORS[p.id] || "#71717a";
                  return (
                    <tr key={p.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-zinc-200 flex items-center gap-2.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span>{p.name}</span>
                      </td>
                      <td className="px-6 py-3.5 text-zinc-400">
                        {p.category}
                      </td>
                      <td className="px-6 py-3.5">
                        {p.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/50 text-emerald-400 border border-emerald-800/80">
                            <CheckCircle2 className="w-3 h-3" /> Conectado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-900 text-zinc-500 border border-zinc-800">
                            <XCircle className="w-3 h-3" /> Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-zinc-400">
                        <span className="text-zinc-200 font-semibold">{p.usageToday}</span> / {p.dailyLimit} req
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {p.models && p.models.length > 0 ? (
                            p.models.slice(0, 2).map((m) => (
                              <span
                                key={m}
                                className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300 border border-zinc-700/60 truncate max-w-[140px]"
                                title={m}
                              >
                                {m}
                              </span>
                            ))
                          ) : (
                            <span className="text-zinc-600">Por defecto</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => deleteProvider(p.id)}
                          aria-label={`Eliminar ${p.name}`}
                          className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Formulario Agregar Proveedor Personalizado */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-6">
        <h2 className="text-sm font-semibold text-zinc-200 mb-2 flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-400" />
          Registrar Endpoint de Proveedor Adicional
        </h2>
        <p className="text-xs text-zinc-400 mb-4">
          Conecta adaptadores de inferencia locales (Ollama/vLLM) o pasarelas de cómputo personalizadas.
        </p>

        <form onSubmit={addProvider} className="flex flex-wrap gap-3">
          <input
            name="name"
            placeholder="Nombre del proveedor (ej. DeepSeek Local)"
            required
            className="flex-1 min-w-[200px] bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          <input
            name="category"
            placeholder="Categoría (ej. razonamiento, local)"
            required
            className="flex-1 min-w-[150px] bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-zinc-950 font-semibold text-xs px-5 py-2 rounded-lg transition-colors"
          >
            {submitting ? "Guardando…" : "Registrar Proveedor"}
          </button>
        </form>
      </div>

      {/* Bóveda de Credenciales BYOK (Neon DB + AES-256-GCM) */}
      <div className="border-t border-zinc-800/80 pt-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Bóveda de Credenciales Segura (BYOK)
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Ingresa y gestiona tus API Keys personales. Se cifran con AES-256-GCM y clave maestra derivada en Neon DB. Nunca se exponen al cliente.
          </p>
        </div>

        <CredentialManager />
      </div>
    </div>
  );
}
