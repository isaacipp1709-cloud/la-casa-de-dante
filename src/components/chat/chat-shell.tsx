"use client";

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './chat-message';
import { ChatComposer } from './chat-composer';
import { z } from 'zod';
import { DanteChatRequestSchema, DanteChatResponseSchema } from '@/contracts/dante';
import { Terminal } from 'lucide-react';

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

  return "Dante no pudo responder en este momento. inténtalo nuevamente.";
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
    <div className="flex flex-col h-full w-full bg-zinc-950 font-[family-name:var(--font-geist-sans)]">
      <div
        className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth"
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Historial de mensajes"
      >
        <div role="list" className="flex flex-col max-w-4xl mx-auto w-full pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-24 text-center space-y-4">
              <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl flex items-center justify-center shadow-sm">
                <Terminal className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-zinc-300 font-medium text-sm">Núcleo conversacional inicializado.</p>
                <p className="text-zinc-500 text-[13px] font-mono">Esperando entrada de usuario...</p>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {isTyping && (
            <div className="flex w-full mb-2 justify-start">
              <div className="bg-zinc-900/50 text-zinc-400 border border-zinc-800 rounded-md px-4 py-3 text-xs font-mono animate-pulse">
                Dante procesando...
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full border-t border-zinc-900 bg-zinc-950/80 backdrop-blur">
        <div className="max-w-4xl mx-auto">
          <ChatComposer onSend={handleSend} disabled={isTyping} />
        </div>
      </div>
    </div>
  );
}
