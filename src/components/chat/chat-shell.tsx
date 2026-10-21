"use client";

import { authorizedFetch, getBrowserAuthClient } from "@/lib/auth/client-session";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChatMessage } from "./chat-message";
import { ChatComposer } from "./chat-composer";
import { Terminal, Plus, RotateCcw, Sparkles, MessageSquare, ShieldCheck, LogIn } from "lucide-react";
import {
  createChatHistoryController,
  type ChatHistorySnapshot,
  type SessionThread,
} from "./chat-history-state";

const QUICK_PROMPTS = [
  "Analiza el estado actual de las 37 neuronas de Von Neumann",
  "Verifica el estado de los contratos Zod en dante-bridge",
  "Resume las políticas de seguridad $0 Tier activas",
];

const EMPTY_FALLBACK_SESSION: SessionThread = {
  id: "nueva-conversacion",
  internalId: "nueva-conversacion",
  title: "Nueva conversación",
  messages: [],
  messagesStatus: "idle",
  messagesLoaded: true,
  messagesError: null,
  sendError: null,
  persistenceWarning: null,
};

export function ChatShell() {
  const controllerRef = useRef<ReturnType<typeof createChatHistoryController> | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createChatHistoryController({
      fetchFn: (input, init) => authorizedFetch(String(input), init),
    });
  }

  const [historyState, setHistoryState] = useState<ChatHistorySnapshot>(() =>
    controllerRef.current!.getSnapshot()
  );

  const [activeSelection, setActiveSelection] = useState<{
    providerId?: string;
    model?: string;
    credentialId?: string;
  }>({});

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = createChatHistoryController({
      fetchFn: (url, init) => authorizedFetch(String(url), init),
      onChange: (snapshot) => {
        setHistoryState(snapshot);
      },
    });
    controllerRef.current = controller;
    setHistoryState(controller.getSnapshot());

    void controller.loadConversations();

    const client = getBrowserAuthClient();
    const subscription = client
      ? client.auth.onAuthStateChange((event, session) => {
          controller.handleAuthStateChange(event, session?.user?.id ?? null);
        }).data.subscription
      : null;

    return () => {
      subscription?.unsubscribe();
      controller.dispose();
    };
  }, []);

  const {
    sessions,
    activeSessionId,
    activeSession,
    conversationsStatus,
    conversationsError,
    isUnauthenticated,
    isLoadingConversations,
    isLoadingMessages,
    isSending,
  } = historyState;

  const currentSession = activeSession ?? EMPTY_FALLBACK_SESSION;
  const messages = currentSession.messages;

  // Para un hilo remoto existente, bloquear el envío mientras sus mensajes estén pendientes de carga, cargándose o en error
  const isHistoryBlocked =
    activeSession !== null &&
    (!activeSession.messagesLoaded ||
      activeSession.messagesStatus === "idle" ||
      activeSession.messagesStatus === "loading" ||
      activeSession.messagesStatus === "error");

  const isSendDisabled = isSending || isHistoryBlocked || isUnauthenticated;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isSending, activeSessionId]);

  const handleSelectSession = useCallback((sessionId: string) => {
    void controllerRef.current?.selectSession(sessionId);
  }, []);

  const handleNewSession = useCallback(() => {
    controllerRef.current?.createNewSession();
  }, []);

  const handleClearCurrent = useCallback(() => {
    controllerRef.current?.clearCurrentMessages();
  }, []);

  const handleRetryConversations = useCallback(() => {
    void controllerRef.current?.retryLoadConversations();
  }, []);

  const handleRetryMessages = useCallback(() => {
    void controllerRef.current?.retryLoadMessages();
  }, []);

  const submitMessage = useCallback(
    async (
      content: string,
      providerOverride?: string,
      modelOverride?: string,
      credentialOverride?: string,
    ) => {
      await controllerRef.current?.submitMessage({
        text: content,
        providerId: providerOverride,
        model: modelOverride,
        credentialId: credentialOverride ?? null,
      });
    },
    []
  );

  const handleSend = (content: string) => {
    void submitMessage(
      content,
      activeSelection.providerId,
      activeSelection.model,
      activeSelection.credentialId
    );
  };

  const handleComposerSend = (message: {
    content: string;
    providerId?: string;
    model?: string;
    credentialId?: string;
  }) => {
    void submitMessage(
      message.content,
      message.providerId,
      message.model,
      message.credentialId
    );
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
          {isLoadingConversations ? (
            <span className="text-xs font-mono text-zinc-400 animate-pulse">
              Cargando conversaciones...
            </span>
          ) : isUnauthenticated ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-amber-400">
                Sesión no autenticada en este dominio.
              </span>
              <Link
                href="/login"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/80 text-[11px] font-mono text-amber-200 transition-colors"
              >
                <LogIn className="w-3 h-3" />
                <span>Iniciar sesión</span>
              </Link>
            </div>
          ) : conversationsStatus === "error" && conversationsError ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-red-400 truncate max-w-xs sm:max-w-md">
                {conversationsError}
              </span>
              <button
                type="button"
                onClick={handleRetryConversations}
                className="px-2 py-1 rounded bg-red-950/60 hover:bg-red-900/60 border border-red-800/80 text-[11px] font-mono text-red-200 transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : sessions.length === 0 ? (
            <span className="text-xs font-mono text-zinc-500">
              Sin conversaciones guardadas
            </span>
          ) : (
            <select
              id="session-selector"
              value={activeSessionId ?? ""}
              onChange={(e) => handleSelectSession(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 truncate max-w-xs sm:max-w-sm"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.messagesLoaded ? `${s.messages.length} msg` : "ver"})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Badge del Pool Inteligente con Auto-Failover */}
          <Link
            href="/dashboard/providers"
            title="Pool Inteligente de Tokens Activo: Conmutación automática en caliente ante saturación (Gemini -> DeepSeek -> NVIDIA -> OpenRouter -> HF -> Groq)"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-mono transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-zinc-400">Pool:</span>
            <span className="text-emerald-400 font-medium">Auto-Failover</span>
          </Link>

          <button
            type="button"
            onClick={handleNewSession}
            disabled={isSendDisabled}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-mono transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Nueva sesión</span>
          </button>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearCurrent}
              disabled={isSending}
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
          {isLoadingMessages && (
            <div className="flex w-full mb-3 justify-start">
              <div className="bg-zinc-900/60 text-zinc-400 border border-zinc-800 rounded-md px-4 py-3 text-xs font-mono animate-pulse">
                Cargando mensajes de la conversación...
              </div>
            </div>
          )}

          {activeSession !== null &&
            (!currentSession.messagesLoaded || currentSession.messagesStatus === "idle") &&
            currentSession.messagesStatus !== "loading" &&
            currentSession.messagesStatus !== "error" && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-800/80 bg-amber-950/30 px-4 py-3 text-xs font-mono text-amber-200">
                <span>
                  Los mensajes de esta conversación están pendientes de carga. Carga el historial antes de continuar.
                </span>
                <button
                  type="button"
                  onClick={handleRetryMessages}
                  className="shrink-0 rounded border border-amber-700 bg-amber-900/40 px-2.5 py-1 text-[11px] text-amber-100 hover:bg-amber-900/70 transition-colors"
                >
                  Cargar mensajes de la conversación
                </button>
              </div>
            )}

          {currentSession.messagesStatus === "error" && currentSession.messagesError && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-800/80 bg-red-950/30 px-4 py-3 text-xs font-mono text-red-200">
              <span>{currentSession.messagesError}</span>
              <button
                type="button"
                onClick={handleRetryMessages}
                className="shrink-0 rounded border border-red-700 bg-red-900/40 px-2.5 py-1 text-[11px] text-red-100 hover:bg-red-900/70 transition-colors"
              >
                Reintentar carga de mensajes
              </button>
            </div>
          )}

          {!isLoadingMessages &&
            currentSession.messagesStatus !== "error" &&
            messages.length === 0 && (
              isUnauthenticated ? (
                <div className="flex flex-col items-center justify-center mt-12 sm:mt-16 text-center max-w-md mx-auto p-6 sm:p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-4">
                  <div className="w-12 h-12 bg-amber-950/40 border border-amber-900/60 text-amber-400 rounded-xl flex items-center justify-center shadow-sm">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-zinc-100 font-semibold text-sm">Sesión no autenticada en este dominio</h3>
                    <p className="text-zinc-400 text-xs font-mono leading-relaxed">
                      Para interactuar con Dante AI, sincronizar tus 37 neuronas, tus credenciales BYOK y tu historial en Neon, inicia sesión con GitHub.
                    </p>
                  </div>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs font-mono transition-colors shadow-sm"
                  >
                    <LogIn className="w-4 h-4 text-zinc-950" />
                    <span>Iniciar sesión con GitHub</span>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center mt-16 sm:mt-20 text-center space-y-5">
                  <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 text-emerald-400 rounded-xl flex items-center justify-center shadow-sm">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-zinc-200 font-medium text-sm">
                      {sessions.length === 0
                        ? "No tienes conversaciones guardadas todavía."
                        : "Núcleo conversacional inicializado."}
                    </p>
                    <p className="text-zinc-500 text-xs font-mono">
                      {activeSessionId
                        ? `Sesión: ${currentSession.id} · Frontera Zod activa`
                        : "Envía tu primer mensaje o crea una nueva sesión para comenzar"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl pt-2">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        disabled={isSendDisabled}
                        onClick={() => handleSend(prompt)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900/70 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 transition-colors text-left disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{prompt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
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

          {currentSession.persistenceWarning && (
            <div className="mt-2 rounded-lg border border-amber-800/80 bg-amber-950/30 px-4 py-2.5 text-xs font-mono text-amber-200">
              {currentSession.persistenceWarning}
            </div>
          )}

          {currentSession.sendError && (
            <div className="mt-2 rounded-lg border border-red-800/80 bg-red-950/30 px-4 py-2.5 text-xs font-mono text-red-200">
              {currentSession.sendError}
            </div>
          )}

          {isSending && (
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
          <ChatComposer
            onSend={handleComposerSend}
            onSelectionChange={setActiveSelection}
            disabled={isSendDisabled}
          />
        </div>
      </div>
    </div>
  );
}
export default ChatShell;
