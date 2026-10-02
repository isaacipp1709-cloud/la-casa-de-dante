import { Home, MessageSquare, Settings, Brain, ScrollText } from "lucide-react";

export function SidebarNav() {
  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-zinc-900 bg-zinc-950 p-4" aria-label="Navegación principal">
      <div className="mb-8 px-2 mt-2">
        <h1 className="text-zinc-100 font-semibold text-sm tracking-tight uppercase">La Casa de Dante</h1>
        <div className="flex items-center gap-2 mt-2">
          <span className="px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800 text-[10px] font-mono uppercase tracking-wider">Modo local</span>
        </div>
      </div>
      <nav className="flex-1 space-y-1.5" aria-label="Menú principal">
        <button disabled className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-600 rounded-md cursor-not-allowed text-left hover:bg-zinc-900/30" aria-label="Casa (Próximamente)">
          <Home className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">Casa</span>
          <span className="text-[9px] uppercase tracking-wider text-zinc-700 font-mono">Próximamente</span>
        </button>
        <button aria-current="page" className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-100 bg-zinc-900 rounded-md border border-zinc-800/80 text-left shadow-sm">
          <MessageSquare className="w-4 h-4 shrink-0 text-zinc-300" />
          <span className="flex-1 font-medium truncate">Conversación</span>
        </button>
        <button disabled className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-600 rounded-md cursor-not-allowed text-left hover:bg-zinc-900/30" aria-label="Sistema (Próximamente)">
          <Settings className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">Sistema</span>
          <span className="text-[9px] uppercase tracking-wider text-zinc-700 font-mono">Próximamente</span>
        </button>
        <button disabled className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-600 rounded-md cursor-not-allowed text-left hover:bg-zinc-900/30" aria-label="Neuronas (Próximamente)">
          <Brain className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">Neuronas</span>
          <span className="text-[9px] uppercase tracking-wider text-zinc-700 font-mono">Próximamente</span>
        </button>
        <button disabled className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-600 rounded-md cursor-not-allowed text-left hover:bg-zinc-900/30" aria-label="Bitácora (Próximamente)">
          <ScrollText className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">Bitácora</span>
          <span className="text-[9px] uppercase tracking-wider text-zinc-700 font-mono">Próximamente</span>
        </button>
      </nav>
    </aside>
  );
}
