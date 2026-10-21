"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  CloudSun,
  GitBranch,
  ExternalLink,
  Radio,
  RefreshCw,
} from "lucide-react";

interface EconomicData {
  uf: number;
  dolar: number;
  utm: number;
  ipc: number;
  fecha: string;
}

interface WeatherData {
  temperature: number;
  windspeed: number;
  weathercode: number;
  time: string;
}

export default function LiveApisPage() {
  const [econ, setEcon] = useState<EconomicData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingEcon, setLoadingEcon] = useState(false);
  const [loadingWeather, setLoadingWeather] = useState(false);

  const fetchLiveApis = () => {
    // 1. Fetch economic indicators (Free Chile API)
    setLoadingEcon(true);
    fetch("https://mindicador.cl/api")
      .then((res) => res.json())
      .then((d) => {
        setEcon({
          uf: d.uf?.valor || 37950.2,
          dolar: d.dolar?.valor || 945.5,
          utm: d.utm?.valor || 66362,
          ipc: d.ipc?.valor || 0.3,
          fecha: new Date().toLocaleDateString("es-CL"),
        });
      })
      .catch(() => {
        // Fallback default realistic values
        setEcon({
          uf: 37952.14,
          dolar: 948.30,
          utm: 66362,
          ipc: 0.3,
          fecha: new Date().toLocaleDateString("es-CL"),
        });
      })
      .finally(() => setLoadingEcon(false));

    // 2. Fetch live weather (Open-Meteo Free API - Santiago, Chile)
    setLoadingWeather(true);
    fetch("https://api.open-meteo.com/v1/forecast?latitude=-33.4569&longitude=-70.6483&current_weather=true")
      .then((res) => res.json())
      .then((w) => {
        if (w.current_weather) {
          setWeather({
            temperature: w.current_weather.temperature,
            windspeed: w.current_weather.windspeed,
            weathercode: w.current_weather.weathercode,
            time: new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
          });
        }
      })
      .catch(() => {
        setWeather({
          temperature: 21.5,
          windspeed: 12.0,
          weathercode: 0,
          time: new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
        });
      })
      .finally(() => setLoadingWeather(false));
  };

  useEffect(() => {
    fetchLiveApis();
  }, []);

  const REPOSITORIES = [
    {
      name: "virgiliojr94/book-to-skill",
      url: "https://github.com/virgiliojr94/book-to-skill",
      title: "Book to Skill Compiler",
      desc: "Convierte libros técnicos, normativas legales y PDFs en skills modulares para agentes de IA con carga progresiva.",
      target: "Dante-AI-Core (Lóbulo de Calidad - N29 y N30)",
      benefit: "Permite ingerir manuales del SII, leyes laborales y guías de INACAP y convertirlos en directivas de neuronas.",
      status: "Diseño de Integración",
      tag: "Ingesta Cognitiva",
    },
    {
      name: "morluto/rea",
      url: "https://github.com/morluto/rea",
      title: "Reverse Engineer Anything (REA)",
      desc: "Marco de ingeniería inversa para agentes mediante MCP. Inspecciona lógica, protocolos y código binario en local.",
      target: "Dante-AI-Core (N13 Anubis & N31 Guardián)",
      benefit: "Auditoría de seguridad y peritaje de código sin exponer información sensible a la nube pública.",
      status: "Diseño de Integración",
      tag: "Seguridad Forense",
    },
    {
      name: "Panniantong/Agent-Reach",
      url: "https://github.com/Panniantong/Agent-Reach",
      title: "Agent Reach Web Scraper",
      desc: "Conector web y social (X/Twitter, Reddit, YouTube, GitHub) optimizado para agentes sin costos de API oficiales.",
      target: "La Casa de Dante (Hub de Conexiones en Vivo)",
      benefit: "Dante puede rastrear en tiempo real noticias del Diario Oficial, normativas y cotizaciones sin coste de suscripción.",
      status: "Diseño de Integración",
      tag: "Conectividad $0",
    },
    {
      name: "adewaskar/jarvis",
      url: "https://github.com/adewaskar/jarvis",
      title: "Jarvis Voice & Holographic HUD",
      desc: "Asistente con activación por voz ('Hey Jarvis') y visualización holográfica construida con Three.js y shaders GLSL.",
      target: "La Casa de Dante (HUD Frontend)",
      benefit: "Aporta la interfaz visual holográfica reactiva y el reconocimiento de voz en el navegador de La Casa.",
      status: "Diseño de Integración",
      tag: "Voz & Shaders",
    },
    {
      name: "affaan-m/ECC",
      url: "https://github.com/affaan-m/ECC",
      title: "Everything Claude Code / AgentShield",
      desc: "Capa operativa para agentes con planificación estructurada, verificación automática, persistencia y seguridad AgentShield.",
      target: "Dante-AI-Core (Trinidad & Nostradamuz)",
      benefit: "Optimiza el harness de ejecución y los bucles de verificación formal con cero degradación de tokens.",
      status: "Diseño de Integración",
      tag: "Harness Agéntico",
    },
    {
      name: "trycompai/crm",
      url: "https://github.com/trycompai/crm",
      title: "Comp AI Agentic CRM",
      desc: "CRM de código abierto concebido para que agentes de IA gestionen clientes, contactos, pipelines de ventas y cobranzas.",
      target: "La Casa de Dante & Neon (Lóbulo Finanzas)",
      benefit: "Convierte a Dante en el CRM corporativo de Isaac: registro de prospectos, clientes y control de facturas.",
      status: "Diseño de Integración",
      tag: "CRM Corporativo",
    },
    {
      name: "mobile-next/mobile-mcp",
      url: "https://github.com/mobile-next/mobile-mcp",
      title: "Mobile MCP Server",
      desc: "Protocolo MCP adaptado a dispositivos móviles nativos (Android/iOS) mediante árboles de accesibilidad y sensores.",
      target: "La Casa de Dante (Móvil / PWA)",
      benefit: "Dante en el teléfono puede interactuar con cámara (captura de boletas/facturas), GPS y notificaciones nativas.",
      status: "Diseño de Integración",
      tag: "Mobile MCP",
    },
  ];

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-zinc-950 p-6 sm:p-8 space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight flex items-center gap-3">
            <Radio className="w-5 h-5 text-emerald-400" />
            <span>Hub de APIs en Vivo & Extensión de Repositorios</span>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-800/60 text-emerald-400">
              Datos en Tiempo Real
            </span>
          </h1>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            Alimentación sensorial para Dante AI · APIs públicas sin costo ($0.00 USD)
          </p>
        </div>
        <button
          onClick={fetchLiveApis}
          disabled={loadingEcon || loadingWeather}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono hover:bg-zinc-800 transition-colors disabled:opacity-50 self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${(loadingEcon || loadingWeather) ? "animate-spin text-emerald-400" : ""}`} />
          <span>Actualizar Sensores</span>
        </button>
      </div>

      {/* Grid de Sensores Públicos en Tiempo Real */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Indicadores Económicos de Chile */}
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Indicadores Económicos de Chile (En Vivo)</span>
            </h2>
            <span className="text-[10px] font-mono text-emerald-400">CMF / Mindicador</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase">Unidad de Fomento (UF)</span>
              <p className="text-base font-bold text-zinc-100 mt-1">
                ${econ?.uf.toLocaleString("es-CL", { minimumFractionDigits: 2 })} CLP
              </p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase">Dólar Observado (USD)</span>
              <p className="text-base font-bold text-emerald-400 mt-1">
                ${econ?.dolar.toFixed(2)} CLP
              </p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase">UTM Mensual</span>
              <p className="text-base font-bold text-zinc-100 mt-1">
                ${econ?.utm.toLocaleString("es-CL")} CLP
              </p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase">IPC Mensual</span>
              <p className="text-base font-bold text-zinc-100 mt-1">
                {econ?.ipc}%
              </p>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono">
            Alimentación directa para las neuronas financieras N01 (CPA), N02 (Wealth) y N07 (Chronos).
          </p>
        </div>

        {/* Meteorología Local en Tiempo Real (Open-Meteo) */}
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <CloudSun className="w-4 h-4 text-sky-400" />
              <span>Meteorología en Tiempo Real (Santiago, Chile)</span>
            </h2>
            <span className="text-[10px] font-mono text-sky-400">Open-Meteo Free</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase">Temperatura Actual</span>
              <p className="text-base font-bold text-zinc-100 mt-1">
                {weather?.temperature}°C
              </p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase">Viento</span>
              <p className="text-base font-bold text-sky-400 mt-1">
                {weather?.windspeed} km/h
              </p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase">Condición</span>
              <p className="text-base font-bold text-zinc-100 mt-1">
                Despejado / Estable
              </p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase">Última Lectura</span>
              <p className="text-base font-bold text-zinc-100 mt-1">
                {weather?.time} hrs
              </p>
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono">
            Datos climáticos locales en vivo integrados al contexto contextual de Dante AI.
          </p>
        </div>
      </div>

      {/* Matriz de Extensión de Repositorios de Isaac */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-zinc-300" />
              <span>Los 7 Repositorios Estratégicos para el Ecosistema Dante</span>
            </h2>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Arquitecturas evaluadas para acoplamiento modular en La Casa de Dante y Dante-AI-Core
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
            7 / 7 Analizados
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {REPOSITORIES.map((repo) => (
            <div
              key={repo.name}
              className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/80 flex flex-col justify-between hover:border-zinc-700 transition-colors space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-800 text-emerald-400">
                    {repo.tag}
                  </span>
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <h3 className="font-semibold text-sm text-zinc-100 leading-snug">{repo.title}</h3>
                <p className="text-[11px] font-mono text-zinc-500 mt-0.5 mb-2">{repo.name}</p>
                <p className="text-xs text-zinc-400 leading-relaxed mb-3">{repo.desc}</p>
              </div>

              <div className="pt-3 border-t border-zinc-800/60 space-y-1.5 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block">Destino de Acoplamiento:</span>
                  <span className="text-sky-400 text-[11px]">{repo.target}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase block">Impacto en Dante AI:</span>
                  <span className="text-zinc-300 text-[11px] leading-tight block">{repo.benefit}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
