import { ReactNode } from "react";
import { SidebarNav } from "../navigation/sidebar-nav";
import { SystemStatusPanel } from "../system/system-status-panel";
import { StatusBar } from "./status-bar";

export function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative" aria-label="Área principal">
          <header className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100">La Casa de Dante</h1>
          </header>
          <div className="flex-1 relative overflow-hidden flex flex-col">
            {children}
          </div>
        </main>
        <SystemStatusPanel />
      </div>
      <StatusBar />
    </div>
  );
}
