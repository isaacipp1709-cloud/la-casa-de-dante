"use client";

import React, { useState, useEffect } from "react";
import { BrainCircuit, Activity } from "lucide-react";

interface Neuron {
  id: string;
  name: string;
  status: string;
  category: string;
  description: string;
  lastExecution: string;
}

export default function NeuronsPage() {
  const [neurons, setNeurons] = useState<Neuron[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/neurons")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setNeurons(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-zinc-950 p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-zinc-100 mb-6 tracking-tight flex items-center gap-3">
        <BrainCircuit className="w-5 h-5 text-zinc-400" /> Neuronas y Módulos Cognitivos
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <p className="text-[13px] text-zinc-600 font-mono animate-pulse col-span-2">
            Escaneando cerebro...
          </p>
        ) : neurons.length === 0 ? (
          <p className="text-[13px] text-zinc-600 font-mono col-span-2">
            No se detectaron neuronas activas.
          </p>
        ) : (
          neurons.map((neuron) => (
            <div
              key={neuron.id}
              className="p-5 rounded-xl border border-zinc-800 bg-zinc-900 flex flex-col justify-between hover:border-zinc-700 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-zinc-200">{neuron.name}</h3>
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                      neuron.status === "activo"
                        ? "bg-emerald-900/20 text-emerald-400 border-emerald-900/50"
                        : "bg-amber-900/20 text-amber-400 border-amber-900/50"
                    }`}
                  >
                    {neuron.status}
                  </span>
                </div>
                <p className="text-[13px] text-zinc-400 mb-4 leading-relaxed">
                  {neuron.description}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-auto text-[11px] text-zinc-500 font-mono pt-4 border-t border-zinc-800/60">
                <Activity className="w-3.5 h-3.5" />
                <span>Últ. ejecución: {new Date(neuron.lastExecution).toLocaleTimeString()}</span>
                <span className="ml-auto text-zinc-600 uppercase">[{neuron.category}]</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
