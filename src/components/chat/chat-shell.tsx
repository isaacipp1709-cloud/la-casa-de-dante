"use client";

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './chat-message';
import { ChatComposer } from './chat-composer';
import { z } from 'zod';
import { DanteChatRequestSchema, DanteChatResponseSchema } from '@/contracts/dante';
import { Terminal, Plus, RotateCcw, Sparkles, MessageSquare } from 'lucide-react';

type DanteChatRequest = z.infer<typeof DanteChatRequestSchema>;
type DanteChatResponse = z.infer<typeof DanteChatResponseSchema>;

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  providerId?: string;
  model?: string;
  correlationId?: string;
  timestamp?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number; };
};

type SessionThread = {
  id: string;
  title: string;
  updatedAt: string;
  messages: Message[];
};

const QUICK_PROMPTS = [
  "Analiza el estado actual de las 37 neuronas de Von Neumann",
  "Verifica el estado de los contratos Zod en dante-bridge",
  "Resume las políticas de seguridad $0 Tier activas",
];

const INITIAL_SESSIONS: SessionThread[] = [
  {
    id: "conv-01-arquitectura",
    title: "Sesión Activa · Centro de Mando",
    updatedAt: new Date().toISOString(),
    messages: [],
  },
  {
    id: "conv-02-neuronas",
    title: "Auditoría 37 Neuronas Cognitivas",
    updatedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    messages: [
      {
        id: "seed-1",
        role: "user",
        content: "Reporte de estado del subsistema ejecutivo y frontera Zod.",
        timestamp: new Date(Date.now() - 1000 * 60 * 26).toISOString(),
      },
      {
        id: "seed-2",
        role: "assistant",
        content:
          "Subsistema Ejecutivo (N01-N06) y Seguridad (N07-N12) operando de forma determinista. Las 8 rutas del puente validan contratos con z.safeParse() bajo política $0 Tier.",
        providerId: "mock-local",
        correlationId: "conv-02-neuronas-2",
        timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
        usage: {
          promptTokens: 14,
          completionTokens: 32,
          totalTokens: 46,
        },
      },
    ],
  },
];

const CHAT_ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND:
    "No tienes una clave guardada que coincida con este proveedor. Guardala y vuelve a intentarlo.",
  UNAUTHORIZED: "Tu sesion no esta autenticada. Inicia sesion para usar una clave guardada.",
  PROVIDER_NOT_SUPPORTED: "El proveedor seleccionado todavia no esta habilitado.",
  PROVIDER_UNAUTHORIZED: "El proveedor rechazo la clave guardada. Verificala o guardala de nuevo.",
  PROVIDER_RATE_LIMITED: "Se alcanzo el limite de uso del proveedor. Intentalo mas tarde.",
  PROVIDER_TIMEOUT: "El proveedor tardo demasiado en responder.",
  PROVIDER_NETWORK_ERROR: "No se pudo conectar con el proveedor.",
  PROVIDER_ERROR: "El proveedor devolvio un error. Intentalo nuevamente.",
  CONFIGURATION_ERROR: "Falta configuracion en el servidor para usar credenciales.",
  INVALID_REQUEST: "La solicitud no es valida. Revisa el contenido e intentalo de nuevo.",
};

const getSafeErrorMessage = (status: number, code?: string) => {
  if (code && CHAT_ERROR_MESSAGES[code]) {
    return CHAT_ERROR_MESSAGES[code];
  }

  if (status === 400) {
    return "No se pudo procesar el mensaje. Revisa el contenido e inténtalo nuevamente.";
  }

  if (status === 401) {
    return "Tu sesion no esta autenticada. Inicia sesion para usar una clave guardada.";
  }

  return "Dante no pudo responder en este momento. inténtalo nuevamente.";
};

export function ChatShell() {
  const [sessions, setSessions] = useState<SessionThread[]>(INITIAL_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string>(INITIAL_SESSIONS[0].id);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentSession =
    sessions.find((s) => s.id === activeSessionId) ?? sessions[0];
  const messages = currentSession.messages;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, activeSessionId]);

  const updateCurrentMessages = (updater: (prev: Message[]) => Message[], newTitle?: string) => {
    setSessions((prevSessions) =>
      prevSessions.map((session) => {
        if (session.id !== currentSession.id) return session;
        const updatedMessages = updater(session.messages);
        return {
          ...session,
          title: newTitle ?? session.title,
          updatedAt: new Date().toISOString(),
          messages: updatedMessages,
        };
      })
    );
  };

  const handleNewSession = () => {
    const newId = `conv-${Date.now().toString().slice(-6)}`;
    const newThread: SessionThread = {
      id: newId,
      title: `Sesión ${newId}`,
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    setSessions((prev) => [newThread, ...prev]);
    setActiveSessionId(newId);
  };

  const handleClearCurrent = () => {
    updateCurrentMessages(() => []);
  };

  const submitMessage = async (
    content: string,
    providerOverride?: string,
    modelOverride?: string,
    credentialOverride?: string,
  ) => {
    // La seleccion llega desde el composer (ProviderSelector) en cada envio.
    const effectiveProvider = providerOverride;
    const effectiveModel = modelOverride;
    const nowIso = new Date().toISOString();
    const userMessage: Message = {
      providerId: effectiveProvider,
      model: effectiveModel,
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: nowIso,
    };

    const inferredTitle =
      messages.length === 0
        ? content.length > 36
          ? `${content.slice(0, 36)}…`
          : content
        : undefined;

    updateCurrentMessages((prev) => [...prev, userMessage], inferredTitle);
    setIsTyping(true);

    try {
      const history = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content })) as DanteChatRequest['messages'];

      const requestPayload: DanteChatRequest = {
        providerId: effectiveProvider,
        model: effectiveModel,
        credentialId: credentialOverride,
        sessionId: currentSession.id,
        conversationId: currentSession.id,
        messages: [...history, { role: 'user', content }],
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!res.ok) {
        let errorCode: string | undefined;
        try {
          const errorBody = (await res.json()) as { error?: { code?: string } };
          errorCode = errorBody?.error?.code;
        } catch {
          // Cuerpo no legible: se usa el mensaje generico por estado.
        }
        throw new Error(getSafeErrorMessage(res.status, errorCode));
      }

      const data = (await res.json()) as DanteChatResponse;

      if (data.status === 'error') {
        throw new Error('Error de validación o servidor.');
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message.content,
        providerId: data.providerId,
        model: data.model,
        correlationId: data.correlationId,
        timestamp: data.message.timestamp || new Date().toISOString(),
        usage: data.usage,
      };

      updateCurrentMessages((prev) => [...prev, assistantMsg]);
    } catch (error: unknown) {
      let errorMessage = 'Error desconocido';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'system',
        content: errorMessage,
        timestamp: new Date().toISOString(),
      };
      updateCurrentMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async (content: string) => {
    await submitMessage(content);
  };

  const handleComposerSend = (message: {
    content: string;
    providerId?: string;
    model?: string;
    credentialId?: string;
  }) => {
    void submitMessage(message.content, message.providerId, message.model, message.credentialId);
  };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 font-[family-name:var(--font-geist-sans)]">
      {/* Barra superior de sesiones de conversación */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2.5 border-b border-zinc-900 bg-zinc-950/90">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
          <label htmlFor="session-selector" className="sr-only">
            Seleccionar conversación
          </label>
          <select
            id="session-selector"
            value={currentSession.id}
            onChange={(e) => setActiveSessionId(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 truncate max-w-xs sm:max-w-sm"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.messages.length} msg)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleNewSession}
            disabled={isTyping}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-mono transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Nueva sesión</span>
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearCurrent}
              disabled={isTyping}
              aria-label="Limpiar sesión actual"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 text-xs font-mono transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reiniciar</span>
            </button>
          )}
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth"
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Historial de mensajes"
      >
        <div role="list" className="flex flex-col max-w-4xl mx-auto w-full pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-16 sm:mt-20 text-center space-y-5">
              <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 text-emerald-400 rounded-xl flex items-center justify-center shadow-sm">
                <Terminal className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-zinc-200 font-medium text-sm">
                  Núcleo conversacional inicializado.
                </p>
                <p className="text-zinc-500 text-xs font-mono">
                  Sesión: {currentSession.id} · Frontera Zod activa
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl pt-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={isTyping}
                    onClick={() => handleSend(prompt)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900/70 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 transition-colors text-left"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              providerId={msg.providerId}
              model={msg.model}
              correlationId={msg.correlationId}
              timestamp={msg.timestamp}
              usage={msg.usage}
            />
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
          <ChatComposer onSend={handleComposerSend} disabled={isTyping} />
        </div>
      </div>
    </div>
  );
}