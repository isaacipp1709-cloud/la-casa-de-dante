"use client";

import { authorizedFetch } from "@/lib/auth/client-session";
import { ALLOWED_GEMINI_MODELS } from "@/lib/providers/gemini";
import { useState, useEffect, useRef } from "react";

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

  const onProviderChangeRef = useRef(onProviderChange);
  useEffect(() => {
    onProviderChangeRef.current = onProviderChange;
  }, [onProviderChange]);

  const initialValProviderId = useRef(val.providerId);

  useEffect(() => {
    const loadProviders = async () => {
      setLoading(true);
      
      try {
        const response = await authorizedFetch("/api/providers");
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            const list: ProviderOption[] = data.map(p => ({
              id: p.id,
              name: p.name,
              category: p.category,
              models: Array.isArray(p.models) ? p.models : []
            }));
            setProviders(list);

            // Pre-seleccionar automáticamente el proveedor operativo principal
            if (!initialValProviderId.current && list.length > 0) {
              const defaultP = list.find(p => p.id === "gemini") || list[0];
              setSelectedProvider(defaultP.id);
              const defaultM = defaultP.models[0] || null;
              setSelectedModel(defaultM);
              onProviderChangeRef.current(defaultP.id, defaultM);
            }
          } else {
            throw new Error("Unexpected response format");
          }
        } else if (response.status === 401 || response.status === 403) {
          setProviders([]);
          return;
        } else {
          throw new Error("HTTP " + response.status + ": " + response.statusText);
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn("Failed to load providers from backend:", reason);
        const fallbackList: ProviderOption[] = [
          { id: "gemini", name: "Google Gemini", category: "razonamiento", models: [...ALLOWED_GEMINI_MODELS] },
          { id: "deepseek", name: "DeepSeek", category: "razonamiento", models: ["deepseek-chat", "deepseek-reasoner"] },
          { id: "nvidia", name: "NVIDIA NIM", category: "razonamiento", models: ["meta/llama-3.1-70b-instruct", "meta/llama-3.3-70b-instruct"] },
          { id: "openrouter", name: "OpenRouter", category: "agregador", models: ["meta-llama/llama-3.3-70b-instruct:free"] },
          { id: "huggingface", name: "Hugging Face", category: "inferencia", models: ["meta-llama/Meta-Llama-3-8B-Instruct"] },
          { id: "groq", name: "Groq", category: "razonamiento", models: ["llama3-8b-8192"] },
          { id: "ollama", name: "Ollama Local", category: "local", models: ["llama3"] },
          { id: "mock", name: "Mock Local", category: "mock", models: ["mock-dante"] }
        ];
        setProviders(fallbackList);
        if (!initialValProviderId.current && fallbackList.length > 0) {
          const defaultP = fallbackList[0];
          setSelectedProvider(defaultP.id);
          const defaultM = defaultP.models[0] || null;
          setSelectedModel(defaultM);
          onProviderChangeRef.current(defaultP.id, defaultM);
        }
      } finally {
        setLoading(false);
      }
    };
    
    void loadProviders();
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
          className="w-full sm:w-36 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600 disabled:opacity-50"
        >
          <option value="">Seleccionar...</option>
          {providers.map(p => <option key={p.id} value={p.id} disabled={loading}>{p.name}</option>)}
        </select>
      </div>

      {selectedProvider && (
        <div className="w-full sm:w-auto mt-2 sm:mt-0">
          <label htmlFor="model-select" className="mb-1 block text-xs font-mono text-zinc-400"> Modelo </label>
          <select
            id="model-select"
            value={selectedModel || ""}
            onChange={handleModelChange}
            disabled={disabled || loading}
            className="w-full sm:w-44 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-600 disabled:opacity-50"
          >
            {providers.find(p => p.id === selectedProvider)?.models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
export default ProviderSelector;
