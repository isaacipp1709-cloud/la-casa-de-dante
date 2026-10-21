"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MessageSquare,
  Settings,
  Brain,
  ScrollText,
  Radio,
  Menu,
  X,
  ShieldCheck,
  LogOut,
  LogIn,
  Database,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { getBrowserAuthClient, signOut } from "@/lib/auth/client-session";

export const navItems = [
  { href: "/dashboard", label: "Casa", icon: Home },
  { href: "/", label: "Conversación", icon: MessageSquare },
  { href: "/connections", label: "Sistema", icon: Settings },
  { href: "/dashboard/providers", label: "APIs", icon: Radio },
  { href: "/database", label: "Base de Datos", icon: Database },
  { href: "/live-apis", label: "APIs en Vivo", icon: Globe },
  { href: "/neurons", label: "Neuronas", icon: Brain },
  { href: "/logs", label: "Bitácora", icon: ScrollText },
];

const disabledItems: Array<{ label: string; icon: LucideIcon }> = [];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

function AuthStatusWidget() {
  const [sessionUser, setSessionUser] = useState<{ email?: string; id?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = getBrowserAuthClient();
    if (!client) {
      setLoading(false);
      return;
    }
    client.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setSessionUser({ email: data.session.user.email, id: data.session.user.id });
      } else {
        setSessionUser(null);
      }
      setLoading(false);
    });

    const sub = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSessionUser({ email: session.user.email, id: session.user.id });
      } else {
        setSessionUser(null);
      }
    });

    return () => {
      sub.data.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/login";
  };

  if (loading) return null;

  if (sessionUser) {
    return (
      <div className="flex flex-col gap-2 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase text-emerald-400 font-semibold tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Conectado
          </span>
          <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[100px]">
            {sessionUser.email?.split("@")[0] || "Isaac"}
          </span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-zinc-800 hover:bg-zinc-700/80 text-zinc-300 hover:text-white transition-colors text-[11px] font-mono"
        >
          <LogOut className="w-3 h-3 text-red-400" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 text-emerald-300 text-xs font-mono transition-colors"
    >
      <LogIn className="w-3.5 h-3.5 text-emerald-400" />
      <span>Iniciar sesión</span>
    </Link>
  );
}

export function MobileHeaderNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="md:hidden flex flex-col border-b border-zinc-800 bg-zinc-950 z-30">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-sm font-semibold tracking-tight text-zinc-100 uppercase">
            La Casa de Dante
          </h1>
          <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-emerald-400 border border-emerald-900/50 text-[9px] font-mono uppercase tracking-wider">
            37N · Zod
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label={open ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
          className="p-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-zinc-800/80 transition-colors"
        >
          {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Barra rápida táctil siempre visible en móvil */}
      <nav
        className="flex items-center gap-1 px-3 pb-2.5 overflow-x-auto"
        aria-label="Navegación rápida móvil"
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = isNavItemActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-zinc-900 text-zinc-100 border border-zinc-700 font-medium"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Menú desplegable completo en móvil */}
      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-zinc-900 bg-zinc-950/95 space-y-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = isNavItemActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive
                    ? "text-zinc-100 bg-zinc-900 border border-zinc-800/80 font-medium"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
          <div className="pt-2">
            <AuthStatusWidget />
          </div>
          <div className="pt-2 border-t border-zinc-900 flex items-center gap-2 text-[11px] text-zinc-500 font-mono px-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>dante-bridge · Protocolo Zod v4 activo</span>
          </div>
        </div>
      )}
    </header>
  );
}

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
          <span className="px-2 py-0.5 rounded-md bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 text-[10px] font-mono uppercase tracking-wider">
            37 Neuronas
          </span>
        </div>
      </div>
      <nav className="flex-1 space-y-1.5" aria-label="Menú principal">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = isNavItemActive(pathname, href);
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

      <div className="mt-auto space-y-3 pt-4 border-t border-zinc-900/80 px-2">
        <AuthStatusWidget />
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="truncate">Frontera Zod · $0 Tier</span>
        </div>
      </div>
    </aside>
  );
}
