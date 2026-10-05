import React from 'react';
import { User, Terminal } from 'lucide-react';

type Role = 'user' | 'assistant' | 'system';

interface ChatMessageProps {
  role: Role;
  content: string;
  providerId?: string;
}

export function ChatMessage({ role, content, providerId }: ChatMessageProps) {
  const isUser = role === 'user';
  const isSystem = role === 'system';

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
      <div className={`w-full flex gap-4 p-4 sm:p-5 rounded-2xl border ${isUser ? 'bg-zinc-900/30 border-transparent' : 'bg-zinc-900/80 border-zinc-800/80 shadow-sm'}`}>
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
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-zinc-500">
              {isUser ? 'Usuario' : 'Dante'}
            </span>
          </div>
          <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-200">
            {content}
          </div>
          {!isUser && providerId && (
            <div className="mt-3 flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded-full border border-zinc-800">
                ⚡ Provider: {providerId}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
