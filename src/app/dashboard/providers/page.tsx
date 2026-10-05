"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, CheckCircle, XCircle } from "lucide-react";

interface Provider {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  usageToday: number;
  dailyLimit: number;
  is_public: boolean;
}

export default function ProvidersPanel() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchProviders = async () => {
    try {
      const res = await fetch("/api/providers");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setProviders(data);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const addProvider = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      category: formData.get("category"),
    };
    try {
      await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      e.currentTarget.reset();
      await fetchProviders();
    } catch {
      // silently ignore
    } finally {
      setSubmitting(false);
    }
  };

  const deleteProvider = async (id: string) => {
    await fetch(`/api/providers?id=${id}`, { method: "DELETE" });
    setProviders((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-zinc-950 p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-zinc-100 mb-6 tracking-tight">
        APIs Conectadas
      </h1>

      {/* Tabla de proveedores */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden mb-8">
        <div className="px-5 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-300">
            Proveedores registrados
          </h2>
        </div>
        {loading ? (
          <p className="px-5 py-6 text-[13px] text-zinc-600 font-mono animate-pulse">
            Cargando proveedores…
          </p>
        ) : providers.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-zinc-600 font-mono">
            No hay proveedores registrados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                  <th className="text-left px-5 py-3">Nombre</th>
                  <th className="text-left px-5 py-3">Categoría</th>
                  <th className="text-left px-5 py-3">Estado</th>
                  <th className="text-left px-5 py-3">Uso hoy</th>
                  <th className="text-left px-5 py-3">Tipo</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {providers.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`${
                      i < providers.length - 1 ? "border-b border-zinc-800/60" : ""
                    } hover:bg-zinc-800/40 transition-colors`}
                  >
                    <td className="px-5 py-3 font-medium text-zinc-200">
                      {p.name}
                    </td>
                    <td className="px-5 py-3 text-zinc-500 font-mono text-[13px]">
                      {p.category}
                    </td>
                    <td className="px-5 py-3">
                      {p.is_active ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-zinc-600" />
                      )}
                    </td>
                    <td className="px-5 py-3 text-zinc-500 font-mono text-[13px]">
                      {p.usageToday}/{p.dailyLimit}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                          p.is_public
                            ? "text-emerald-400 border-emerald-900 bg-emerald-900/20"
                            : "text-zinc-500 border-zinc-700 bg-zinc-800/50"
                        }`}
                      >
                        {p.is_public ? "Público" : "Privado"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => deleteProvider(p.id)}
                        aria-label={`Eliminar ${p.name}`}
                        className="text-zinc-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Formulario agregar */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Agregar proveedor
        </h2>
        <form onSubmit={addProvider} className="flex flex-wrap gap-3">
          <input
            name="name"
            placeholder="Nombre"
            required
            className="flex-1 min-w-[160px] bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
          <input
            name="category"
            placeholder="Categoría"
            required
            className="flex-1 min-w-[120px] bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-100 text-sm px-5 py-2 rounded-md transition-colors"
          >
            {submitting ? "Agregando…" : "Agregar"}
          </button>
        </form>
        <p className="mt-3 text-[11px] text-zinc-600 font-mono">
          Las API keys se configuran exclusivamente en las variables de entorno del servidor. No se almacenan aquí.
        </p>
      </div>
    </div>
  );
}
