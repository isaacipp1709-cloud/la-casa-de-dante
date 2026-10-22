"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  CheckCircle2,
  Circle,
  Activity,
  ListTodo,
  Zap,
  Bot,
  User,
} from "lucide-react";
import { authorizedFetch } from "@/lib/auth/client-session";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

interface ActionItem {
  id: string;
  title: string;
  status: "completed" | "in_progress" | "pending";
  category: "arquitectura" | "seguridad" | "despliegue" | "optimizacion";
  priority: "alta" | "media" | "baja";
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

const DEFAULT_ACTIONS: ActionItem[] = [
  {
    id: "act-1",
    title: "Auditoría y verificación de conectividad La Casa ➔ Core en Vercel Producción",
    status: "completed",
    category: "despliegue",
    priority: "alta",
  },
  {
    id: "act-2",
    title: "Activación del Pool Inteligente de Tokens con Auto-Failover (6 APIs)",
    status: "completed",
    category: "arquitectura",
    priority: "alta",
  },
  {
    id: "act-3",
    title: "Incorporación del Copiloto Ejecutivo OpenJarvis y síntesis de voz en tiempo real",
    status: "in_progress",
    category: "arquitectura",
    priority: "alta",
  },
  {
    id: "act-4",
    title: "Monitoreo continuo de cuotas gratuitas $0.00 USD en Neon, Supabase y Gemini",
    status: "in_progress",
    category: "seguridad",
    priority: "media",
  },
];

const EXECUTIVE_PROMPTS = [
  "Jarvis, dame el resumen ejecutivo del estado del ecosistema Dante en producción.",
  "Jarvis, desglosa un plan de acción para conectar el siguiente módulo de IA.",
  "Jarvis, evalúa los riesgos y cuotas de las APIs activas en este momento.",
];

export default function JarvisExecutivePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init-msg",
      role: "assistant",
      content:
        "Saludos, señor Patricio. Soy J.A.R.V.I.S., su copiloto ejecutivo y orquestador autónomo de OpenJarvis. Los sistemas centrales de Dante AI Core, la matriz de 37 neuronas y el pool inteligente de tokens están en línea y operando con normalidad. ¿En qué meta nos enfocaremos hoy?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actions, setActions] = useState<ActionItem[]>(DEFAULT_ACTIONS);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  // Sintetizador de voz nativo Web Speech API
  const speakText = useCallback(
    (text: string) => {
      if (!voiceOutputEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const cleanText = text
          .replace(/[#*_`~[\]()]/g, "")
          .replace(/https?:\/\/\S+/g, "enlace")
          .trim();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = "es-CL";
        utterance.rate = 1.05;
        utterance.pitch = 0.95;

        const voices = window.speechSynthesis.getVoices();
        const spanishVoice = voices.find((v) => v.lang.startsWith("es"));
        if (spanishVoice) {
          utterance.voice = spanishVoice;
        }

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("[JarvisSpeech] Fallo al sintetizar audio:", err);
      }
    },
    [voiceOutputEnabled]
  );

  // Reconocimiento de voz nativo Web Speech API
  const toggleListening = () => {
    if (typeof window === "undefined") return;

    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };

    const SpeechRecognitionClass =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setStatusMessage("El reconocimiento de voz no es compatible con este navegador.");
      setTimeout(() => setStatusMessage(null), 4000);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = "es-CL";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        void handleSend(transcript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        console.warn("[SpeechRecognition Error]", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn("[SpeechRecognition Start Error]", err);
      setIsListening(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const rawText = textToSend ?? input;
    const trimmed = rawText.trim();
    if (!trimmed || isProcessing) return;

    setInput("");
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const res = await authorizedFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: trimmed },
          ],
          archetypeId: "jarvis",
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        const errMsg =
          errJson?.error?.message ||
          "Señor, hubo una anomalía al procesar la solicitud en Dante AI Core.";
        const assistantError: Message = {
          id: `ast-${Date.now()}`,
          role: "assistant",
          content: `[Aviso Ejecutivo] ${errMsg}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, assistantError]);
        speakText(errMsg);
        return;
      }

      const data = (await res.json()) as {
        message?: { content?: string };
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content =
        data?.message?.content ||
        data?.choices?.[0]?.message?.content ||
        "Comprendido, señor. La directiva ha sido registrada en el sistema central.";

      const assistantMsg: Message = {
        id: `ast-${Date.now()}`,
        role: "assistant",
        content,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      speakText(content);
    } catch {
      const errorFallback: Message = {
        id: `ast-${Date.now()}`,
        role: "assistant",
        content:
          "Señor, no fue posible contactar el enlace cloud en este momento. Por favor verifique la conexión de red.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorFallback]);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleAction = (id: string) => {
    setActions((prev) =>
      prev.map((act) => {
        if (act.id !== id) return act;
        return {
          ...act,
          status: act.status === "completed" ? "pending" : "completed",
        };
      })
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 font-[family-name:var(--font-geist-sans)]">
      {/* HUD Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-zinc-900 bg-zinc-950/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-800/80 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-950/50">
            <Mic className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-zinc-100 tracking-wide">
                J.A.R.V.I.S. Command Deck
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                OpenJarvis Engine
              </span>
            </div>
            <p className="text-[11px] font-mono text-zinc-500">
              Copiloto Ejecutivo & Despacho Autónomo · Arquetipo Jarvis
            </p>
          </div>
        </div>

        {/* Telemetría y Controles de Voz */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-zinc-200">Core Cloud:</span>
            <span className="text-emerald-400">Online</span>
          </div>

          <button
            type="button"
            onClick={() => setVoiceOutputEnabled((v) => !v)}
            title={voiceOutputEnabled ? "Desactivar voz de Jarvis" : "Activar voz de Jarvis"}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
              voiceOutputEnabled
                ? "bg-cyan-950/40 text-cyan-200 border-cyan-800/80 hover:bg-cyan-900/50"
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
            }`}
          >
            {voiceOutputEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">
              {voiceOutputEnabled ? "Voz Activa" : "Voz Silenciada"}
            </span>
          </button>
        </div>
      </div>

      {/* Grid Principal: Chat y Planificador */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
        {/* Columna Izquierda / Central: Consola Conversacional */}
        <div className="lg:col-span-2 flex flex-col h-full border-r border-zinc-900 overflow-hidden">
          {/* Historial de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 max-w-3xl ${
                  m.role === "user" ? "ml-auto justify-end" : "justify-start"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-cyan-950/60 border border-cyan-800/80 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`rounded-xl p-3.5 text-xs font-mono leading-relaxed max-w-[85%] ${
                    m.role === "user"
                      ? "bg-zinc-800/90 text-zinc-100 border border-zinc-700/80"
                      : "bg-zinc-900/70 text-zinc-300 border border-zinc-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1 text-[10px] text-zinc-500">
                    <span className="font-semibold text-zinc-400">
                      {m.role === "user" ? "Isaac Patricio" : "J.A.R.V.I.S."}
                    </span>
                    <span>{m.timestamp}</span>
                  </div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
                {m.role === "user" && (
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isProcessing && (
              <div className="flex gap-3 items-center text-xs font-mono text-cyan-400 animate-pulse">
                <div className="w-7 h-7 rounded-lg bg-cyan-950/60 border border-cyan-800/80 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <span>Jarvis procesando directiva ejecutiva...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Rápidos */}
          <div className="px-4 py-2 border-t border-zinc-900/80 bg-zinc-950/60 flex flex-wrap gap-1.5">
            {EXECUTIVE_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(prompt)}
                disabled={isProcessing}
                className="text-[11px] font-mono text-zinc-400 hover:text-cyan-300 bg-zinc-900 hover:bg-zinc-850 px-2.5 py-1 rounded-md border border-zinc-800 transition-colors truncate max-w-full disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input & Botón de Micrófono */}
          <div className="p-4 border-t border-zinc-900 bg-zinc-950/90">
            {statusMessage && (
              <div className="mb-2 text-[11px] font-mono text-amber-300 bg-amber-950/30 border border-amber-800/60 rounded px-2.5 py-1">
                {statusMessage}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={toggleListening}
                title={isListening ? "Detener micrófono" : "Hablar con Jarvis"}
                className={`p-2.5 rounded-xl border transition-all ${
                  isListening
                    ? "bg-red-950/80 border-red-600 text-red-200 animate-pulse ring-2 ring-red-500/30"
                    : "bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-cyan-400"
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Escuchando su voz..." : "Escriba o hable con Jarvis..."}
                disabled={isProcessing}
                className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-cyan-700 rounded-xl px-3.5 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-500 focus:outline-none transition-colors"
              />

              <button
                type="submit"
                disabled={!input.trim() || isProcessing}
                className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Columna Derecha: Planificador de Metas y Compromisos (Executive Action Deck) */}
        <div className="hidden lg:flex flex-col h-full bg-zinc-950 p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Header de Metas */}
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <ListTodo className="w-4 h-4 text-cyan-400" />
              <span>Plan de Acción Ejecutivo</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">
              {actions.filter((a) => a.status === "completed").length}/{actions.length} listos
            </span>
          </div>

          {/* Lista de Acciones */}
          <div className="space-y-2">
            {actions.map((act) => (
              <div
                key={act.id}
                onClick={() => toggleAction(act.id)}
                className={`p-3 rounded-xl border text-xs font-mono cursor-pointer transition-all ${
                  act.status === "completed"
                    ? "bg-zinc-900/40 border-zinc-850 opacity-60 text-zinc-500 line-through"
                    : "bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 text-zinc-300"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-cyan-400 shrink-0">
                    {act.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-zinc-600" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="leading-snug">{act.title}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-500">
                      <span className="uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-850">
                        {act.category}
                      </span>
                      <span
                        className={
                          act.priority === "alta" ? "text-amber-400" : "text-zinc-500"
                        }
                      >
                        Prioridad {act.priority}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Resumen de Capacidades OpenJarvis */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-cyan-950/20 to-zinc-900/40 border border-cyan-900/40 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
              <Zap className="w-4 h-4" />
              <span>Capacidades de OpenJarvis Activas</span>
            </div>
            <ul className="text-[11px] font-mono text-zinc-400 space-y-1.5 list-disc list-inside">
              <li>Orquestación multimodal con voz bidireccional nativa.</li>
              <li>Auto-planificación proactiva sin cuotas adicionales ($0.00).</li>
              <li>Sincronización directa con las 37 neuronas de Dante.</li>
              <li>Canalización al Pool Inteligente con auto-failover.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
