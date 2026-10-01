"use client";

import React, { KeyboardEvent, useRef, useEffect } from 'react';

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
    <div className="flex gap-3 items-end border-t border-gray-200 p-4 bg-white dark:bg-gray-950 dark:border-gray-800">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInput}
        onKeyDown={onKeyDown}
        placeholder="Escribe un mensaje a Dante..."
        disabled={disabled}
        className="flex-1 max-h-32 min-h-[44px] resize-none rounded-xl border border-gray-300 p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 transition-colors shadow-sm overflow-y-auto"
        rows={1}
        aria-label="Caja de texto para el mensaje"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !input.trim()}
        className="h-[44px] px-5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors shadow-sm"
        aria-label="Enviar mensaje"
      >
        Enviar
      </button>
    </div>
  );
}
