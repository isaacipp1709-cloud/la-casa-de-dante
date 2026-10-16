"use client";

import { useState, useEffect } from "react";

export interface ProviderOption {
  id: string;
  name: string;
  category: string;
  models: string[];
}

export interface ProviderSelectorProps {
  onProviderChange: (providerId: string | null, model: string | null) => void;
  disabled?: boolean;
  value?: { providerId: string | null; model: string | null };
}

export function ProviderSelector({ onProviderChange, disabled = false, value: val = { providerId: null, model: null } }: ProviderSelectorProps) {
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(val.providerId);
  const [selectedModel, setSelectedModel] = useState<string | null>(val.model);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProviders = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch("/api/providers");
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            setProviders(data.map(p => ({
              id: p.id,
              name: p.name,
              category: p.category,
              models: Array.isArray(p.models) ? p.models : []
            })));
          } else {
            throw new Error("Unexpected response format");
          }
        } else {
          throw new Error("HTTP " + response.status + ": " + response.statusText);
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn("Failed to load providers from backend:", reason);
        setError("No se pudo cargar la lista de proveedores desde el backend");
        // Fall back to static mock catalog - explicitly marked as unverified
        setProviders([
          { id: "groq", name: "Groq", category: "razonamiento", models: ["llama3-8b-8192"] },
          { id: "gemini", name: "Google Gemini", category: "razonamiento", models: ["gemini-2.0-flash"] },
          { id: "ollama", name: "Ollama Local", category: "local", models: ["llama3"] },
          { id: "mock", name: "Mock Local", category: "mock", models: ["mock-dante"] }
        ]);
      } finally {
        setLoading(false);
      }
    };
    
    loadProviders();
  }, []);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const providerId = e.target.value || null;
    setSelectedProvider(providerId);
    const provider = providers.find(p => p.id === providerId);
    const model = provider ? provider.models[0] : null;
    setSelectedModel(model);
    onProviderChange(providerId, model);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    setSelectedModel(model);
    onProviderChange(selectedProvider, model);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:gap-3 w-full">
      <div className="w-full sm:w-auto">
        <label htmlFor="provider-select" className="mb-1 block text-xs font-mono text-zinc-400"> Provider </label>
        <select
          id="provider-select"
          value={selectedProvider || ""}
          onChange={handleProviderChange}
          disabled={disabled || loading}
          className="w-full sm:w-32 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600 disabled:opacity-50"
        >
          <option value="">Seleccionar...</option>
          {providers.map(p => <option key={p.id} value={p.id} disabled={loading}>{p.name}</option>)}
          {providers.length > 0 && !loading && !error && <option value="" disabled className="text-zinc-500">(catálogo local no verificado)</option>}
        </select>
      </div>
      <div className="w-full sm:w-auto mt-2 sm:mt-0">
        <label htmlFor="model-select" className="mb-1 block text-xs font-mono text-zinc-400"> Modelo </label>
        <select
          id="model-select"
          value={selectedModel || ""}
          onChange={handleModelChange}
          disabled={disabled || !selectedProvider || loading}
          className="w-full sm:w-32 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600 disabled:opacity-50"
        >
          <option value="">Seleccionar...</option>
          {selectedProvider && providers.find(p => p.id === selectedProvider)?.models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}
