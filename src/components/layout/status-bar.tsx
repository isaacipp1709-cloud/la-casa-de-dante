export function StatusBar() {
  return (
    <footer className="h-8 border-t border-zinc-900 bg-zinc-950 flex items-center justify-between px-4 text-[11px] font-mono text-zinc-500 shrink-0" aria-label="Barra de estado">
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
          <span>API local</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true"></span>
          <span className="sm:hidden">Local &middot; Mock offline</span>
          <span className="hidden sm:inline">MockDanteProvider</span>
        </div>
      </div>
      <div className="hidden sm:block">
        <span>Modo offline</span>
      </div>
    </footer>
  );
}
