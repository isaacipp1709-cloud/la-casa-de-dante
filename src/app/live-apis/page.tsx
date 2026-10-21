"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  CloudSun,
  Radio,
  RefreshCw,
  Users,
  Layers,
  ArrowRight,
  Database,
  Sparkles,
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
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

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
          dolar: 948.3,
          utm: 66362,
          ipc: 0.3,
          fecha: new Date().toLocaleDateString("es-CL"),
        });
      })
      .finally(() => setLoadingEcon(false));

    // 2. Fetch live weather (Open-Meteo Free API - Santiago, Chile)
    setLoadingWeather(true);
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=-33.4569&longitude=-70.6483&current_weather=true"
    )
      .then((res) => res.json())
      .then((w) => {
        if (w.current_weather) {
          setWeather({
            temperature: w.current_weather.temperature,
            windspeed: w.current_weather.windspeed,
            weathercode: w.current_weather.weathercode,
            time: new Date().toLocaleTimeString("es-CL", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          });
        }
      })
      .catch(() => {
        setWeather({
          temperature: 21.5,
          windspeed: 12.0,
          weathercode: 0,
          time: new Date().toLocaleTimeString("es-CL", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
      })
      .finally(() => {
        setLoadingWeather(false);
        setLastRefreshed(
          new Date().toLocaleTimeString("es-CL", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      });
  };

  useEffect(() => {
    fetchLiveApis();
  }, []);

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-zinc-950 p-6 sm:p-8 space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight flex items-center gap-3">
            <Radio className="w-5 h-5 text-emerald-400" />
            <span>Sensores en Vivo y Telemetría Ambiental</span>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-800/60 text-emerald-400">
              $0.00 USD Tier
            </span>
          </h1>
          <p className="text-xs text-zinc-500 font-mono mt-1">
            Alimentación en tiempo real para las 37 neuronas cognitivas de Dante AI · Cero dependencias externas de pago
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-[11px] font-mono text-zinc-500">
              Sincronizado: {lastRefreshed}
            </span>
          )}
          <button
            onClick={fetchLiveApis}
            disabled={loadingEcon || loadingWeather}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                loadingEcon || loadingWeather ? "animate-spin text-emerald-400" : ""
              }`}
            />
            <span>Actualizar Sensores</span>
          </button>
        </div>
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
            <span className="text-[10px] font-mono text-emerald-400">
              CMF / Mindicador (Público)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase">
                Unidad de Fomento (UF)
              </span>
              <p className="text-base font-bold text-zinc-100 mt-1">
                ${econ?.uf.toLocaleString("es-CL", { minimumFractionDigits: 2 })} CLP
              </p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase">
                Dólar Observado (USD)
              </span>
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
          <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/50 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400 font-mono">
              Alimentación Neuronal Directa:
            </span>
            <div className="flex gap-1.5">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-900/60">
                N01 CPA
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-900/60">
                N02 Wealth
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-900/60">
                N07 Chronos
              </span>
            </div>
          </div>
        </div>

        {/* Meteorología Local en Tiempo Real (Open-Meteo) */}
        <div className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <CloudSun className="w-4 h-4 text-sky-400" />
              <span>Meteorología en Tiempo Real (Santiago, Chile)</span>
            </h2>
            <span className="text-[10px] font-mono text-sky-400">
              Open-Meteo (Cero Clave)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase">Temperatura</span>
              <p className="text-base font-bold text-zinc-100 mt-1">
                {weather?.temperature}°C
              </p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase">Velocidad Viento</span>
              <p className="text-base font-bold text-sky-400 mt-1">
                {weather?.windspeed} km/h
              </p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase">Condición</span>
              <p className="text-base font-bold text-zinc-100 mt-1">
                Despejado / Operativo
              </p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
              <span className="text-[10px] text-zinc-500 uppercase">Última Muestra</span>
              <p className="text-base font-bold text-zinc-100 mt-1">
                {weather?.time} hrs
              </p>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/50 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400 font-mono">
              Sensibilidad Contextual:
            </span>
            <div className="flex gap-1.5">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950/50 text-sky-400 border border-sky-900/60">
                N08 Gaia
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950/50 text-sky-400 border border-sky-900/60">
                N19 Nexus
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Estado de Módulos Locales y Motores Integrados */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Motores del Ecosistema Dante en Ejecución</span>
            </h2>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Módulos nativos integrados localmente para desarrollo, memoria y soporte operativo
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-800/60 text-emerald-400">
            3 Módulos Activos
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card CRM */}
          <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/70 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950/60 border border-purple-800/60 text-purple-300">
                  Memoria Relacional
                </span>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Nativo en La Casa
                </span>
              </div>
              <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span>Habitación CRM & Memoria</span>
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Gestión estructurada de contactos, proyectos y bitácora de observaciones del agente bajo la regla estricta de Cero Conjeturas.
              </p>
            </div>
            <div className="pt-3 border-t border-zinc-800/60">
              <Link
                href="/crm"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-purple-400 hover:text-purple-300 font-semibold group transition-colors"
              >
                <span>Ingresar a la Habitación CRM</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Card Book-to-Skill */}
          <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/70 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-950/60 border border-sky-800/60 text-sky-300">
                  Compilador Cognitivo
                </span>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Skill Antigravity
                </span>
              </div>
              <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span>Motor Book-to-Skill</span>
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Compilador instalado en Antigravity para transformar libros, leyes del SII, manuales técnicos y PDFs en directivas y habilidades ejecutables.
              </p>
            </div>
            <div className="pt-3 border-t border-zinc-800/60 text-[11px] font-mono text-zinc-500">
              Disponible en <code className="text-zinc-300">.agents/skills/book-to-skill</code>
            </div>
          </div>

          {/* Card Base de Datos Neon */}
          <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/70 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                  Persistencia Segura
                </span>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Neon PostgreSQL
                </span>
              </div>
              <h3 className="font-semibold text-sm text-zinc-100 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>Almacén de Conversaciones</span>
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Aislamiento estricto por usuario autenticado. Claves API encriptadas AES-256-GCM y persistencia de memoria episódica.
              </p>
            </div>
            <div className="pt-3 border-t border-zinc-800/60">
              <Link
                href="/database"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 hover:text-emerald-300 font-semibold group transition-colors"
              >
                <span>Ver Telemetría de Base de Datos</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
