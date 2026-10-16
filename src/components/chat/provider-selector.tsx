"use client";

import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";

export interface ProviderOption {
  id: string; name: string; category: string; isAvailable: () => boolean; models: string[];
}

export interface ProviderSelectorProps {
  onProviderChange: (providerId: string | null, model: string | null) => void;
  disabled?: boolean;
  value?: { providerId: string | null; model: string | null };
}

const MOCK_PROVIDERS: ProviderOption[] = [
  { id: "groq", name: "Groq", category: "razonamiento", isAvailable: () => !!process.env.GROQ_API_KEY, models: ["llama3-8b-8192"] },
  { id: "gemini", name: "Google Gemini", category: "razonamiento", isAvailable: () => !!(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY), models: ["gemini-2.0-flash"] },
  { id: "ollama", name: "Ollama", category: "local", isAvailable: () => !!process.env.OLLAMA_BASE_URL, models: ["llama3"] },
  { id: "mock", name: "Mock Local", category: "mock", isAvailable: () => true, models: ["mock-dante"] },
];

export function ProviderSelector({ onProviderChange, disabled = false, value: val = { providerId: null, model: null } }: ProviderSelectorProps) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(val.providerId);
  const [selectedModel, setSelectedModel] = useState<string | null>(val.model);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProviders = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/providers");
        if (res.ok) console.log("Providers loaded from API");
      } catch { console.warn("Using mock providers"); }
      finally { setLoading(false); }
    };
    fetchProviders();
  }, []);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pid = e.target.value || null;
    setSelectedProvider(pid);
    const provider = MOCK_PROVIDERS.find(p => p.id === pid);
    const model = provider ? provider.models[0] : null;
    setSelectedModel(model);
    onProviderChange(pid, model);
  };

  return (
    <div className="flex gap-2 items-end mb-2">
      <div>
        <label htmlFor="provider-selector" className="block text-[10px] font-mono text-zinc-500 mb-0.5">Proveedor</label>
        <select id="provider-selector" value={selectedProvider || ""} onChange={handleProviderChange} disabled={disabled || loading}
          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600">
          <option value="">Seleccionar</option>
          {MOCK_PROVIDERS.map(p => <option key={p.id} value={p.id} disabled={!p.isAvailable()} className={!p.isAvailable()?"text-zinc-500":""}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="model-selector" className="block text-[10px] font-mono text-zinc-500 mb-0.5">Modelo</label>
        <select id="model-selector" value={selectedModel || ""} onChange={e => { setSelectedModel(e.target.value); onProviderChange(selectedProvider, e.target.value); }} disabled={disabled || !selectedProvider || loading}
          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-600">
          <option value="">Seleccionar</option>
          {MOCK_PROVIDERS.find(p => p.id === selectedProvider)?.models.map(m => <option key={m} value={m}>{m}</option>) || []}
        </select>
      </div>
    </div>
  );
}
