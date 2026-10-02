import { Server, Activity, Database, Radio, Network } from "lucide-react";

export function SystemStatusPanel() {
  return (
    <aside className="hidden lg:block w-72 border-l border-zinc-900 bg-zinc-950 p-4 overflow-y-auto" aria-label="Estado del sistema">
      <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 mt-2 px-1">Estado del sistema</h2>
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
          <div className="flex items-center gap-2 mb-1 text-zinc-300">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[13px] font-medium">Núcleo conversacional</span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono ml-5.5 pl-0.5">Preparado</p>
        </div>
        
        <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
          <div className="flex items-center gap-2 mb-1 text-zinc-300">
            <Server className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[13px] font-medium">Proveedor activo</span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono ml-5.5 pl-0.5">MockDanteProvider</p>
        </div>

        <div className="p-3 rounded-lg bg-zinc-900/20 border border-zinc-800/30 opacity-70">
          <div className="flex items-center gap-2 mb-1 text-zinc-400">
            <Network className="w-3.5 h-3.5" />
            <span className="text-[13px] font-medium">Red externa</span>
          </div>
          <p className="text-[11px] text-zinc-600 font-mono ml-5.5 pl-0.5">Deshabilitada</p>
        </div>

        <div className="p-3 rounded-lg bg-zinc-900/20 border border-zinc-800/30 opacity-70">
          <div className="flex items-center gap-2 mb-1 text-zinc-400">
            <Database className="w-3.5 h-3.5" />
            <span className="text-[13px] font-medium">Persistencia</span>
          </div>
          <p className="text-[11px] text-zinc-600 font-mono ml-5.5 pl-0.5">No configurada</p>
        </div>

        <div className="p-3 rounded-lg bg-zinc-900/20 border border-zinc-800/30 opacity-70">
          <div className="flex items-center gap-2 mb-1 text-zinc-400">
            <Radio className="w-3.5 h-3.5" />
            <span className="text-[13px] font-medium">Telemetría</span>
          </div>
          <p className="text-[11px] text-zinc-600 font-mono ml-5.5 pl-0.5">Sin datos</p>
        </div>
      </div>
    </aside>
  );
}
