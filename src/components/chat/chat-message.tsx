"use client";

import React, { useState } from 'react';
import { User, Terminal, Copy, Check, Cpu, Hash, Coins } from 'lucide-react';

type Role = 'user' | 'assistant' | 'system';

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface ChatMessageProps {
  role: Role;
  content: string;
  providerId?: string;
  correlationId?: string;
  usage?: TokenUsage;
  timestamp?: string;
}

export function ChatMessage({
  role,
  content,
  providerId,
  correlationId,
  usage,
  timestamp,
}: ChatMessageProps) {
  const isUser = role === 'user';
  const isSystem = role === 'system';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  if (isSystem) {
    return (
      <div
        className="flex w-full mb-3 justify-center"
        role="listitem"
        aria-label="Mensaje del sistema"
      >
        <div className="max-w-[85%] bg-red-950/30 text-red-400 border border-red-900/50 rounded-md px-4 py-2 text-xs font-mono text-center">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex w-full mb-4"
      role="listitem"
      aria-label={`Mensaje de ${isUser ? 'Usuario' : 'Dante'}`}
    >
      <div
        className={`w-full flex gap-4 p-4 sm:p-5 rounded-2xl border ${
          isUser
            ? 'bg-zinc-900/30 border-zinc-800/40'
            : 'bg-zinc-900/80 border-zinc-800/80 shadow-sm'
        }`}
      >
        <div className="shrink-0 mt-0.5">
          {isUser ? (
            <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 border border-zinc-700">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-md bg-zinc-100 flex items-center justify-center text-zinc-900 shadow-sm">
              <Terminal className="w-4 h-4" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-zinc-400">
                {isUser ? 'Usuario' : 'Dante'}
              </span>
              {timestamp && (
                <span className="text-[10px] font-mono text-zinc-600">
                  {new Date(timestamp).toLocaleTimeString('es-CL', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
            {!isUser && (
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copiar respuesta"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/70 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            )}
          </div>
          <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-200">
            {content}
          </div>
          {!isUser && (providerId || correlationId || usage) && (
            <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex flex-wrap items-center gap-2">
              {providerId && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-zinc-950 px-2 py-0.5 rounded-full border border-emerald-900/50">
                  <Cpu className="w-3 h-3" />
                  <span>Provider: {providerId}</span>
                </span>
              )}
              {usage && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-sky-400 bg-zinc-950 px-2 py-0.5 rounded-full border border-sky-900/50">
                  <Coins className="w-3 h-3" />
                  <span>{usage.totalTokens} tokens ($0)</span>
                </span>
              )}
              {correlationId && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded-full border border-zinc-800">
                  <Hash className="w-3 h-3" />
                  <span>{correlationId}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
