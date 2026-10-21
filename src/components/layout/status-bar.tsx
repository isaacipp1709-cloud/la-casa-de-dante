"use client";

import { authorizedFetch } from "@/lib/auth/client-session";
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
  const [isPreview, setIsPreview] = useState(false);

  const refresh = async () => {
    try {
      const res = await authorizedFetch("/api/connections");
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
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host.endsWith(".vercel.app") && host !== "la-casa-de-dante.vercel.app") {
        setIsPreview(true);
      }
    }
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, []);

  const isCloud =
    process.env.NEXT_PUBLIC_DANTE_MODE === "cloud" ||
    (typeof window !== "undefined" && !window.location.hostname.includes("localhost"));
  const modeLabel = isCloud ? "Dante AI · Cloud Core" : "Dante AI · Core Activo";

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
        {isPreview && (
          <a
            href="https://la-casa-de-dante.vercel.app"
            className="text-amber-400 hover:text-amber-300 underline flex items-center gap-1 font-semibold text-[10px]"
          >
            ⚠️ URL Preview · Ir a la-casa-de-dante.vercel.app
          </a>
        )}
      </div>
      <div className="hidden sm:flex items-center gap-3">
        <span>37 Neuronas Activas</span>
        <span className="text-zinc-800">·</span>
        <span>{modeLabel}</span>
      </div>
    </footer>
  );
}
