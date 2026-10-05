"use client";

import React, { useState, useEffect } from "react";
import { TerminalSquare, AlertTriangle, Info, AlertCircle } from "lucide-react";

interface Log {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  module: string;
  message: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>("all");

  useEffect(() => {
    fetch("/api/logs")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.logs)) setLogs(data.logs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getLevelIcon = (level: string) => {
    if (level === "error") return <AlertCircle className="w-4 h-4 text-red-400" />;
    if (level === "warn") return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    return <Info className="w-4 h-4 text-blue-400" />;
  };

  const filteredLogs = filterLevel === "all" ? logs : logs.filter((l) => l.level === filterLevel);

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-zinc-950 p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-zinc-100 tracking-tight flex items-center gap-3">
          <TerminalSquare className="w-5 h-5 text-zinc-400" /> Bitácora de Auditoría
        </h1>
        
        <select 
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono rounded-md px-3 py-1.5 focus:outline-none focus:border-zinc-700"
        >
          <option value="all">Nivel: ALL</option>
          <option value="info">INFO</option>
          <option value="warn">WARN</option>
          <option value="error">ERROR</option>
        </select>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm flex-1 max-h-[80vh] flex flex-col">
        {loading ? (
          <div className="p-8 text-[13px] text-zinc-600 font-mono animate-pulse text-center flex-1">
            Cargando bitácora...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-[13px] text-zinc-600 font-mono text-center flex-1">
            No hay registros para mostrar.
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 p-0 m-0 w-full font-mono text-[12px] md:text-[13px] divide-y divide-zinc-800/60">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-4 p-3 sm:px-5 hover:bg-zinc-800/30 transition-colors">
                <div className="shrink-0 pt-0.5">{getLevelIcon(log.level)}</div>
                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
                  <div className="text-zinc-300 leading-snug break-words">
                    <span className="text-zinc-500 font-bold uppercase mr-2 text-[11px]">[{log.module}]</span>
                    {log.message}
                  </div>
                  <div className="shrink-0 text-zinc-500 text-[11px] whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
