"use client";

import { useEffect, useState } from "react";
import { Signal, Wifi, WifiOff } from "lucide-react";

type ConnectionStatus = "online" | "unstable" | "offline";

interface Connection {
  id: string;
  name: string;
  status: ConnectionStatus;
  details: string;
}

const ICONS: Record<ConnectionStatus, React.ComponentType<{ className?: string }>> = {
  online: Wifi,
  unstable: Signal,
  offline: WifiOff,
};

const STATUS_COLORS: Record<ConnectionStatus, { dot: string; text: string; border: string }> = {
  online: {
    dot: "bg-emerald-500",
    text: "text-emerald-400",
    border: "border-emerald-900/60",
  },
  unstable: {
    dot: "bg-amber-500",
    text: "text-amber-400",
    border: "border-amber-900/60",
  },
  offline: {
    dot: "bg-red-600",
    text: "text-red-400",
    border: "border-red-900/60",
  },
};

const LABEL: Record<ConnectionStatus, string> = {
  online: "Operativo",
  unstable: "Inestable",
  offline: "Desconectado",
};

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConnections = async () => {
    try {
      const res = await fetch("/api/connections");
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
    const interval = setInterval(fetchConnections, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-zinc-950 p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-zinc-100 mb-6 tracking-tight flex items-center gap-3">
        <Signal className="w-5 h-5 text-zinc-400" /> Estado del sistema
      </h1>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-300">Conexiones activas</h2>
          <p className="text-[11px] text-zinc-600 font-mono mt-0.5">
            Actualiza cada 5 segundos
          </p>
        </div>

        {loading && connections.length === 0 ? (
          <div className="px-5 py-8 text-[13px] text-zinc-600 font-mono animate-pulse flex items-center gap-3">
            <div className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-transparent animate-spin" />
            Estableciendo enlace de telemetría…
          </div>
        ) : (
          <ul>
            {connections.map((conn, i) => {
              const colors = STATUS_COLORS[conn.status];
              const Icon = ICONS[conn.status];
              return (
                <li
                  key={conn.id}
                  className={`flex items-center justify-between px-5 py-4 ${
                    i < connections.length - 1 ? "border-b border-zinc-800/70" : ""
                  } transition-colors hover:bg-zinc-800/30`}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative flex items-center justify-center w-6 h-6">
                      <span
                        className={`absolute w-3.5 h-3.5 rounded-full ${colors.dot}`}
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-zinc-200">
                        {conn.name}
                      </h3>
                      <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                        {conn.details}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border bg-zinc-900 ${colors.text} ${colors.border}`}
                  >
                    <Icon className="w-3 h-3" />
                    {LABEL[conn.status]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
