"use client";

import React, { useState } from "react";

export interface ProviderUsageItem {
  id: string;
  name: string;
  color: string;
  usageToday: number;
  dailyLimit: number;
  tokens: number;
  percentage: number;
  isActive: boolean;
}

interface ProviderUsageDonutProps {
  items: ProviderUsageItem[];
  totalTokens: number;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}

export function ProviderUsageDonut({
  items,
  totalTokens,
  selectedId: controlledSelectedId,
  onSelect,
}: ProviderUsageDonutProps) {
  const [internalHoverId, setInternalHoverId] = useState<string | null>(null);

  const activeId = internalHoverId ?? controlledSelectedId ?? null;
  const activeItem = items.find((it) => it.id === activeId) ?? null;

  // Parámetros de geometría SVG
  const radius = 68;
  const strokeWidth = 18;
  const center = 90;
  const circumference = 2 * Math.PI * radius;

  // Calculamos los offsets acumulados para el dashoffset de SVG
  let cumulativePercentage = 0;
  const segments = items
    .filter((item) => item.percentage > 0)
    .map((item) => {
      const strokeLength = (item.percentage / 100) * circumference;
      const strokeSpace = circumference - strokeLength;
      const strokeDashoffset = -(cumulativePercentage / 100) * circumference;
      cumulativePercentage += item.percentage;

      return {
        ...item,
        strokeLength,
        strokeSpace,
        strokeDashoffset,
      };
    });

  const handleMouseEnter = (id: string) => {
    setInternalHoverId(id);
    onSelect?.(id);
  };

  const handleMouseLeave = () => {
    setInternalHoverId(null);
    onSelect?.(null);
  };

  return (
    <div className="flex flex-col md:flex-row items-center gap-6 w-full">
      {/* Contenedor del Gráfico SVG */}
      <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
        <svg
          viewBox="0 0 180 180"
          className="w-full h-full transform -rotate-90 drop-shadow-sm"
          role="img"
          aria-label="Gráfico circular de consumo de APIs"
        >
          {/* Anillo de fondo (track) */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#27272a" /* zinc-800 */
            strokeWidth={strokeWidth}
          />

          {/* Segmentos por proveedor */}
          {segments.map((seg) => {
            const isHighlighted = activeId === seg.id;
            const isDimmed = activeId !== null && !isHighlighted;

            return (
              <circle
                key={seg.id}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={isHighlighted ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${seg.strokeLength} ${seg.strokeSpace}`}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-300 ease-out cursor-pointer"
                style={{
                  opacity: isDimmed ? 0.35 : 1,
                  filter: isHighlighted
                    ? `drop-shadow(0 0 8px ${seg.color}88)`
                    : "none",
                }}
                onMouseEnter={() => handleMouseEnter(seg.id)}
                onMouseLeave={handleMouseLeave}
                onClick={() => onSelect?.(seg.id === controlledSelectedId ? null : seg.id)}
              />
            );
          })}
        </svg>

        {/* Centro del Donut (KPI Central) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
          {activeItem ? (
            <>
              <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-400">
                {activeItem.name}
              </span>
              <span className="text-xl font-bold font-mono text-zinc-100 tracking-tight">
                {activeItem.percentage.toFixed(1)}%
              </span>
              <span className="text-[11px] font-mono text-emerald-400 mt-0.5">
                {activeItem.tokens.toLocaleString()} tok
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                Total Tokens
              </span>
              <span className="text-xl font-bold font-mono text-zinc-100 tracking-tight">
                {totalTokens.toLocaleString()}
              </span>
              <span className="text-[11px] font-mono text-zinc-400 mt-0.5">
                {items.filter((i) => i.tokens > 0).length} en uso
              </span>
            </>
          )}
        </div>
      </div>

      {/* Leyenda y Desglose por Proveedor */}
      <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {items.map((item) => {
          const isSelected = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onMouseEnter={() => handleMouseEnter(item.id)}
              onMouseLeave={handleMouseLeave}
              onClick={() => onSelect?.(isSelected ? null : item.id)}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all duration-200 ${
                isSelected
                  ? "bg-zinc-800/80 border-zinc-600 shadow-sm"
                  : "bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-800/40 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: item.color,
                    boxShadow: isSelected ? `0 0 6px ${item.color}` : "none",
                  }}
                />
                <div className="truncate">
                  <div className="text-xs font-medium text-zinc-200 truncate">
                    {item.name}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500">
                    {item.usageToday} req / día
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0 pl-2">
                <div className="text-xs font-mono font-semibold text-zinc-300">
                  {item.percentage.toFixed(1)}%
                </div>
                <div className="text-[10px] font-mono text-zinc-500">
                  {item.tokens.toLocaleString()} tkn
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
