"use client";

import React, { KeyboardEvent, useRef, useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { ProviderSelector } from "./provider-selector";
import { CredentialSelector } from "./credential-selector";

interface ChatComposerProps {
  onSend: (message: {
    content: string;
    providerId?: string;
    model?: string;
    credentialId?: string;
  }) => void;
  disabled?: boolean;
}

export function ChatComposer({ onSend, disabled = false }: ChatComposerProps) {
  const [input, setInput] = useState('');
  const [providerId, setProviderId] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (!disabled && textareaRef.current) textareaRef.current.focus(); }, [disabled]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      // Se envia solo la referencia: la clave nunca sale del servidor.
      onSend({
        content: trimmed,
        providerId: providerId || undefined,
        model: model || undefined,
        credentialId: credentialId || undefined,
      });
      setInput('');
      // La seleccion se conserva para los siguientes mensajes de la conversacion.
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col sm:flex-row sm:items-end sm:gap-3 w-full">
        <ProviderSelector
          onProviderChange={(p, m) => { setProviderId(p); setModel(m); setCredentialId(null); }}
          disabled={disabled}
        />
        <CredentialSelector
          providerId={providerId}
          onCredentialChange={setCredentialId}
          disabled={disabled}
        />
      </div>
      <div className="flex gap-3 items-end p-4 sm:p-6">
        <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown}
          placeholder="Ingresar comando o consulta..." disabled={disabled} rows={1}
          className="flex-1 max-h-32 min-h-[48px] resize-none rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5 text-sm focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200 transition-colors shadow-sm overflow-y-auto" />
        <button onClick={handleSend} disabled={disabled || !input.trim()}
          className="h-[48px] w-[48px] flex items-center justify-center bg-zinc-100 text-zinc-900 rounded-xl hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors shadow-sm shrink-0" aria-label="Enviar mensaje">
          <ArrowUp className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
