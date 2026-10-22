"use client";

import React from "react";
import { Sparkles, Terminal, Palette, Compass } from "lucide-react";

export interface ArchetypeOption {
  id: string;
  name: string;
  role: string;
  badge: string;
  icon: "sparkles" | "terminal" | "palette" | "compass";
  color: string;
}

export const ARCHETYPES: readonly ArchetypeOption[] = [
  {
    id: "dante",
    name: "Dante Nativo",
    role: "Razonamiento Sistémico & Memoria",
    badge: "⚡ Dante",
    icon: "sparkles",
    color: "#10b981", // Emerald
  },
  {
    id: "devin",
    name: "Modo Devin",
    role: "Ingeniería de Software Autónoma",
    badge: "💻 Devin",
    icon: "terminal",
    color: "#38bdf8", // Sky blue
  },
  {
    id: "v0",
    name: "Modo v0 UI/UX",
    role: "Diseño & Arquitectura Frontend",
    badge: "🎨 v0 UI",
    icon: "palette",
    color: "#a855f7", // Purple
  },
  {
    id: "manus",
    name: "Modo Manus",
    role: "Investigación & Ejecución Multi-Paso",
    badge: "🔍 Manus",
    icon: "compass",
    color: "#f59e0b", // Amber
  },
];

interface ArchetypeSelectorProps {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function ArchetypeSelector({
  value,
  onChange,
  disabled = false,
}: ArchetypeSelectorProps) {
  const current = ARCHETYPES.find((a) => a.id === value) ?? ARCHETYPES[0];

  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor="archetype-select" className="sr-only">
        Arquetipo Cognitivo
      </label>
      <div className="relative inline-flex items-center">
        <select
          id="archetype-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="appearance-none bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 focus:border-zinc-700 text-xs font-mono text-zinc-200 rounded-lg pl-7 pr-7 py-1.5 focus:outline-none transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title={`Arquetipo: ${current.name} - ${current.role}`}
        >
          {ARCHETYPES.map((arch) => (
            <option key={arch.id} value={arch.id} className="bg-zinc-900 text-zinc-200">
              {arch.badge} — {arch.role}
            </option>
          ))}
        </select>

        {/* Icono a la izquierda */}
        <span
          className="absolute left-2.5 pointer-events-none w-3.5 h-3.5 flex items-center justify-center"
          style={{ color: current.color }}
        >
          {current.icon === "sparkles" && <Sparkles className="w-3.5 h-3.5" />}
          {current.icon === "terminal" && <Terminal className="w-3.5 h-3.5" />}
          {current.icon === "palette" && <Palette className="w-3.5 h-3.5" />}
          {current.icon === "compass" && <Compass className="w-3.5 h-3.5" />}
        </span>

        {/* Punto indicador de estado a la derecha */}
        <span
          className="absolute right-2.5 pointer-events-none w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: current.color, boxShadow: `0 0 6px ${current.color}aa` }}
        />
      </div>
    </div>
  );
}
