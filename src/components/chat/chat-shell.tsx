"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './chat-message';
import { ChatComposer } from './chat-composer';
import type { z } from 'zod';
import { DanteChatRequestSchema, DanteChatResponseSchema } from '@/contracts/dante';

type DanteChatRequest = z.infer<typeof DanteChatRequestSchema>;
type DanteChatResponse = z.infer<typeof DanteChatResponseSchema>;

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

const getSafeErrorMessage = (status: number) => {
  if (status === 400) {
    return "No se pudo procesar el mensaje. Revisa el contenido e inténtalo nuevamente.";
  }

  return "Dante no pudo responder en este momento. Inténtalo nuevamente.";
};

export function ChatShell() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (content: string) => {
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      // Map to correct API format
      const history = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })) as DanteChatRequest['messages'];

      const requestPayload: DanteChatRequest = {
        messages: [...history, { role: 'user', content }],
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!res.ok) {
        throw new Error(getSafeErrorMessage(res.status));
      }

      const data = (await res.json()) as DanteChatResponse;

      if (data.status === 'error') {
        throw new Error('Error de validación o servidor.');
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message.content,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: unknown) {
      let errorMessage = 'Error desconocido';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'system',
        content: errorMessage,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full max-w-4xl mx-auto bg-gray-50 dark:bg-gray-950 sm:border-x border-gray-200 dark:border-gray-800 shadow-sm font-[family-name:var(--font-geist-sans)]">
      <header className="px-6 py-4 border-b bg-white dark:bg-gray-950 dark:border-gray-800 flex items-center justify-between shadow-sm z-10">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 tracking-tight">La Casa de Dante</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mt-0.5">Offline Mode</p>
        </div>
      </header>

      <main
        className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth"
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Historial de mensajes"
      >
        <div role="list" className="flex flex-col gap-2 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-20 text-center space-y-3">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xl shadow-sm">👋</div>
              <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs">
                No hay mensajes aún. Escribe algo para comenzar a charlar con Dante.
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {isTyping && (
            <div className="flex w-full mb-4 justify-start">
              <div className="bg-gray-200/50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400 rounded-2xl rounded-bl-none px-4 py-3 text-sm italic animate-pulse shadow-sm border border-transparent">
                Dante está respondiendo...
              </div>
            </div>
          )}
        </div>
      </main>

      <ChatComposer onSend={handleSend} disabled={isTyping} />
    </div>
  );
}
