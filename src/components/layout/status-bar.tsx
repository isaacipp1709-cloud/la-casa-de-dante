"use client";

import { useEffect, useState } from "react";

type ConnStatus = "online" | "unstable" | "offline" | "loading";

const DOT_COLOR: Record<ConnStatus, string> = {
  online: "bg-emerald-500",
  unstable: "bg-amber-500",
  offline: "bg-red-600",
  loading: "bg-zinc-600 animate-pulse",
};

const LABEL: Record<ConnStatus, string> = {
  online: "Core operativo",
  unstable: "Core inestable",
  offline: "Core desconectado",
  loading: "Conectando...",
};

export function StatusBar() {
  const [status, setStatus] = useState<ConnStatus>("loading");
  const [details, setDetails] = useState<string>("");

  const refresh = async () => {
    try {
      const res = await fetch("/api/connections");
      if (!res.ok) { setStatus("offline"); return; }
      const data: { id: string; status: string; details: string }[] = await res.json();
      const core = data.find((c) => c.id === "dante-core");
      if (!core) { setStatus("offline"); return; }
      setStatus(core.status as ConnStatus);
      setDetails(core.details);
    } catch {
      setStatus("offline");
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer
      className="h-8 border-t border-zinc-900 bg-zinc-950 flex items-center justify-between px-4 text-[11px] font-mono text-zinc-500 shrink-0"
      aria-label="Barra de estado"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${DOT_COLOR[status]}`}
            aria-hidden="true"
          />
          <span>{LABEL[status]}</span>
        </div>
        {details && (
          <span className="hidden sm:inline text-zinc-700">{details}</span>
        )}
      </div>
      <div className="hidden sm:block">
        <span>Dante AI · local-core</span>
      </div>
    </footer>
  );
}
