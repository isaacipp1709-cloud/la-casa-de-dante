"use client";

import React, { KeyboardEvent, useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface ChatComposerProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatComposer({ onSend, disabled }: ChatComposerProps) {
  const [input, setInput] = React.useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setInput('');
      if (textareaRef.current) {
         textareaRef.current.style.height = 'auto'; // Reset height
      }
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
    }
  };

  return (
    <div className="flex gap-3 items-end p-4 sm:p-6">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInput}
        onKeyDown={onKeyDown}
        placeholder="Ingresar comando o consulta..."
        disabled={disabled}
        className="flex-1 max-h-32 min-h-[48px] resize-none rounded-xl border border-zinc-800 bg-zinc-900/50 p-3.5 text-sm focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200 transition-colors shadow-sm overflow-y-auto"
        rows={1}
        aria-label="Caja de texto para el mensaje"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !input.trim()}
        className="h-[48px] w-[48px] flex items-center justify-center bg-zinc-100 text-zinc-900 rounded-xl hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors shadow-sm shrink-0"
        aria-label="Enviar mensaje"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </div>
  );
}
