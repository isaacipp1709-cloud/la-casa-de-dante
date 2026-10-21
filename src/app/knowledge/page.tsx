"use client";

import { useState, useRef } from "react";
import {
  Network,
  Maximize2,
  Minimize2,
  RefreshCw,
  Cpu,
  Layers,
  GitBranch,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";

type GraphScope = "core" | "casa";

interface GraphMeta {
  title: string;
  repo: string;
  path: string;
  nodes: number;
  edges: number;
  communities: number;
  reduction: string;
  description: string;
  extractor: string;
}

const GRAPH_METAS: Record<GraphScope, GraphMeta> = {
  core: {
    title: "Dante-AI-Core (Orquestación & 37 Neuronas)",
    repo: "isaacipp1709-cloud/Dante-AI-Core",
    path: "/graphs/core-graph.html",
    nodes: 1367,
    edges: 2035,
    communities: 118,
    reduction: "80% de tokens",
    description:
      "Cartografía semántica de las 37 neuronas de Von Neumann, adaptadores BYOK, guardas criptográficas y políticas de persistencia en Neon.",
    extractor: "Tree-Sitter AST (TypeScript / Python / SQL)",
  },
  casa: {
    title: "La Casa de Dante (Frontend Operativo)",
    repo: "isaacipp1709-cloud/la-casa-de-dante",
    path: "/graphs/casa-graph.html",
    nodes: 1075,
    edges: 2303,
    communities: 67,
    reduction: "75% de tokens",
    description:
      "Arquitectura de componentes Next.js 14, habitaciones sensoriales, puente seguro con el Core, telemetría y gestor de credenciales.",
    extractor: "Tree-Sitter AST (TypeScript / TSX / React)",
  },
};

export default function KnowledgePage() {
  const [scope, setScope] = useState<GraphScope>("core");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeMeta = GRAPH_METAS[scope];

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleReload = () => {
    setIsReloading(true);
    if (iframeRef.current) {
      iframeRef.current.src = activeMeta.path + "?t=" + Date.now();
    }
    setTimeout(() => setIsReloading(false), 600);
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full w-full bg-zinc-950 ${
        isFullscreen ? "p-4" : "p-6 sm:p-8"
      } space-y-6 overflow-y-auto`}
    >
      {/* Cabecera Principal */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-zinc-100 tracking-tight flex items-center gap-2.5">
                <span>Grafo de Conocimiento & Cartografía Cognitiva</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
                  Graphify Engine
                </span>
              </h1>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">
                Exploración visual determinista sin costo de API · Detección de comunidades Leiden & Tree-Sitter
              </p>
            </div>
          </div>
        </div>

        {/* Selector de Ámbito (Core vs Casa) y Controles */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center p-1 rounded-lg bg-zinc-900 border border-zinc-800">
            <button
              type="button"
              onClick={() => setScope("core")}
              className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all flex items-center gap-1.5 ${
                scope === "core"
                  ? "bg-zinc-800 text-emerald-400 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Dante-AI-Core</span>
            </button>
            <button
              type="button"
              onClick={() => setScope("casa")}
              className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all flex items-center gap-1.5 ${
                scope === "casa"
                  ? "bg-zinc-800 text-sky-400 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>La Casa de Dante</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleReload}
            disabled={isReloading}
            title="Recargar Grafo"
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isReloading ? "animate-spin text-emerald-400" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Tarjetas KPI de Telemetría del Grafo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
            Nodos Extraídos
          </span>
          <p className="text-xl font-bold font-mono text-zinc-100 mt-1">
            {activeMeta.nodes.toLocaleString()}
          </p>
          <span className="text-[10px] font-mono text-emerald-400 mt-0.5 block">
            {activeMeta.extractor}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
            Conexiones / Relaciones
          </span>
          <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
            {activeMeta.edges.toLocaleString()}
          </p>
          <span className="text-[10px] font-mono text-zinc-500 mt-0.5 block">
            Extracted & Inferred
          </span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
            Comunidades Detectadas
          </span>
          <p className="text-xl font-bold font-mono text-sky-400 mt-1">
            {activeMeta.communities}
          </p>
          <span className="text-[10px] font-mono text-zinc-500 mt-0.5 block">
            Clustering Leiden
          </span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
            Eficiencia de Tokens
          </span>
          <p className="text-xl font-bold font-mono text-purple-400 mt-1">
            {activeMeta.reduction}
          </p>
          <span className="text-[10px] font-mono text-zinc-500 mt-0.5 block">
            vs. Ingesta plana de archivos
          </span>
        </div>
      </div>

      {/* Contenedor del Grafo Interactivo */}
      <div className="flex-1 min-h-[580px] rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden relative shadow-2xl flex flex-col">
        {/* Barra superior del lienzo */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800 text-xs font-mono">
          <div className="flex items-center gap-2 text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-zinc-100">{activeMeta.title}</span>
            <span className="text-zinc-500 hidden sm:inline">({activeMeta.repo})</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-zinc-400">
            <span className="hidden md:inline">Usa la rueda para zoom · Arrastra nodos para explorar</span>
            <a
              href={activeMeta.path}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <span>Abrir en pestaña</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Iframe del visor interactivo vis-network generado por Graphify */}
        <iframe
          ref={iframeRef}
          src={activeMeta.path}
          title={`Grafo de Conocimiento - ${activeMeta.title}`}
          className="w-full flex-1 border-none bg-[#0f0f1a]"
        />
      </div>

      {/* Panel Explicativo de Integración con Dante AI */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400" />
          <span>¿Cómo opera este grafo dentro del Sistema Dante tipo Jarvis?</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono text-zinc-400">
          <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/80 space-y-1">
            <span className="text-zinc-200 font-semibold flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-emerald-400" />
              1. Consulta Semántica (BFS)
            </span>
            <p className="text-zinc-500 leading-relaxed">
              En lugar de buscar con grep en cientos de archivos, Dante consulta <code className="text-zinc-300">graphify query</code> para encontrar el subgrafo exacto de la pregunta.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/80 space-y-1">
            <span className="text-zinc-200 font-semibold flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-sky-400" />
              2. Rastreo de Caminos Críticos
            </span>
            <p className="text-zinc-500 leading-relaxed">
              Dante calcula <code className="text-zinc-300">graphify path &quot;A&quot; &quot;B&quot;</code> para conocer la ruta de llamadas exacta entre una neurona y una base de datos.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800/80 space-y-1">
            <span className="text-zinc-200 font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              3. Cero Consumo de API
            </span>
            <p className="text-zinc-500 leading-relaxed">
              El mapa se extrae localmente con Tree-Sitter AST. No consume tokens de visión ni saldo en la nube pública.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
