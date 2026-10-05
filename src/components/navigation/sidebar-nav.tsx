"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageSquare,
  Settings,
  Brain,
  ScrollText,
  Radio,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Casa", icon: Home },
  { href: "/", label: "Conversación", icon: MessageSquare },
  { href: "/connections", label: "Sistema", icon: Settings },
  { href: "/dashboard/providers", label: "APIs", icon: Radio },
];

const disabledItems = [
  { label: "Neuronas", icon: Brain },
  { label: "Bitácora", icon: ScrollText },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden md:flex flex-col w-64 border-r border-zinc-900 bg-zinc-950 p-4"
      aria-label="Navegación principal"
    >
      <div className="mb-8 px-2 mt-2">
        <h1 className="text-zinc-100 font-semibold text-sm tracking-tight uppercase">
          La Casa de Dante
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <span className="px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800 text-[10px] font-mono uppercase tracking-wider">
            Dante AI
          </span>
        </div>
      </div>
      <nav className="flex-1 space-y-1.5" aria-label="Menú principal">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md text-left transition-colors ${
                isActive
                  ? "text-zinc-100 bg-zinc-900 border border-zinc-800/80 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-zinc-300" : ""}`} />
              <span className={`flex-1 truncate ${isActive ? "font-medium" : ""}`}>
                {label}
              </span>
            </Link>
          );
        })}

        <div className="pt-2 border-t border-zinc-900 mt-2 space-y-1.5">
          {disabledItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              disabled
              aria-label={`${label} (Próximamente)`}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-600 rounded-md cursor-not-allowed text-left"
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
              <span className="text-[9px] uppercase tracking-wider text-zinc-700 font-mono">
                Próximamente
              </span>
            </button>
          ))}
        </div>
      </nav>
    </aside>
  );
}
