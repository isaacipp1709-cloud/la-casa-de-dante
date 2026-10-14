import {
  DanteChatRequest,
  DanteChatResponse,
  DanteNeuronsResponse,
  DanteAnalytics,
  DanteConversationsResponse,
  DanteLogsResponse,
  DanteProvidersResponse,
  DanteProviderCreateRequest,
  DanteConnectionsResponse,
  DanteHealthResponse,
} from "./types";
import {
  DanteChatResponseSchema,
  DanteNeuronsResponseSchema,
  DanteAnalyticsSchema,
  DanteConversationsResponseSchema,
  DanteLogsResponseSchema,
  DanteProvidersResponseSchema,
  DanteProviderCreateRequestSchema,
  DanteConnectionsResponseSchema,
  DanteHealthResponseSchema,
} from "@/contracts/dante";
import { ValidationError } from "./errors";

export class MockDanteProvider {
  private providers: DanteProvidersResponse = [
    {
      id: "groq-llama3",
      name: "Groq LPU (Llama 3.3 70B)",
      category: "llm-fast",
      is_active: true,
      usageToday: 14,
      dailyLimit: 14400,
      is_public: false,
    },
    {
      id: "gemini-flash",
      name: "Google Gemini 2.0 Flash",
      category: "llm-multimodal",
      is_active: true,
      usageToday: 6,
      dailyLimit: 1500,
      is_public: false,
    },
    {
      id: "mock-local",
      name: "Dante Mock Provider ($0 Offline)",
      category: "deterministic-fallback",
      is_active: true,
      usageToday: 28,
      dailyLimit: 999999,
      is_public: true,
    },
  ];

  private conversations: DanteConversationsResponse = [
    {
      id: "conv-01-arquitectura",
      external_id: "Auditoría de Frontera Zod (dante-bridge)",
      updated_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    },
    {
      id: "conv-02-neuronas",
      external_id: "Sincronización de 37 Neuronas Cognitivas",
      updated_at: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
    },
    {
      id: "conv-03-seguridad",
      external_id: "Verificación Zero-Cost & RLS Deny-by-Default",
      updated_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
  ];

  private totalMessagesCount = 42;

  async processChat(request: DanteChatRequest): Promise<DanteChatResponse> {
    const sessionId = request.sessionId ?? "local-session";
    const correlationId = `${sessionId}-${request.messages.length}`;
    const now = new Date().toISOString();

    this.totalMessagesCount += 2;
    const convId = request.conversationId ?? sessionId;
    const existingConv = this.conversations.find((c) => c.id === convId);
    if (existingConv) {
      existingConv.updated_at = now;
    } else {
      this.conversations.unshift({
        id: convId,
        external_id: `Sesión ${convId.slice(0, 12)}`,
        updated_at: now,
      });
    }

    const response: DanteChatResponse = {
      message: {
        role: "assistant",
        content: "Esta es una respuesta simulada de Dante-AI-Core. Operando en modo offline y $0 cost.",
        timestamp: now,
      },
      status: "success",
      correlationId: correlationId,
      providerId: "mock-local",
      usage: {
        promptTokens: 10,
        completionTokens: 25,
        totalTokens: 35,
      },
    };

    // Validar determinísticamente la respuesta antes de enviarla
    const result = DanteChatResponseSchema.safeParse(response);
    if (!result.success) {
      throw new Error("El mock provider generó una respuesta inválida");
    }

    return result.data;
  }

  getNeurons(): DanteNeuronsResponse {
    const now = Date.now();
    const rawNeurons: DanteNeuronsResponse = [
      {
        id: "n-01-frontal-orchestrator",
        name: "N01 · Orquestador Ejecutivo Frontal",
        status: "activo",
        category: "ejecutivo",
        description: "Coordina la distribución de intenciones entre las 37 neuronas y selecciona la ruta determinista óptima.",
        lastExecution: new Date(now - 1000 * 15).toISOString(),
      },
      {
        id: "n-02-zod-sentinel",
        name: "N02 · Centinela de Contratos (dante-bridge)",
        status: "activo",
        category: "seguridad",
        description: "Inspecciona y valida cada payload entrante y saliente mediante esquemas estrictos z.safeParse().",
        lastExecution: new Date(now - 1000 * 8).toISOString(),
      },
      {
        id: "n-03-episodic-memory",
        name: "N03 · Memoria Episódica y Contextual",
        status: "activo",
        category: "memoria",
        description: "Consolida el contexto de conversación reciente y recupera fragmentos relevantes sin contaminar el núcleo.",
        lastExecution: new Date(now - 1000 * 42).toISOString(),
      },
      {
        id: "n-04-logical-verifier",
        name: "N04 · Verificador Lógico de Von Neumann",
        status: "activo",
        category: "razonamiento",
        description: "Evalúa la consistencia formal y ausencia de alucinaciones antes de emitir cualquier conclusión.",
        lastExecution: new Date(now - 1000 * 60).toISOString(),
      },
      {
        id: "n-05-cost-governor",
        name: "N05 · Gobernador de Cuotas ($0 Tier)",
        status: "activo",
        category: "auditoría",
        description: "Supervisa el consumo de tokens y llamadas a proveedores gratuitos (Groq, Gemini, Supabase).",
        lastExecution: new Date(now - 1000 * 30).toISOString(),
      },
      {
        id: "n-06-semantic-ingestor",
        name: "N06 · Ingestor Semántico Documental",
        status: "en_espera",
        category: "percepción",
        description: "Preprocesa y vectoriza documentos autorizados bajo políticas deny-by-default.",
        lastExecution: new Date(now - 1000 * 600).toISOString(),
      },
    ];

    const parsed = DanteNeuronsResponseSchema.safeParse(rawNeurons);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.format());
    }
    return parsed.data;
  }

  getAnalytics(): DanteAnalytics {
    const rawAnalytics = {
      totalConversations: this.conversations.length,
      totalMessages: this.totalMessagesCount,
      averageLatencyMs: 38,
    };

    const parsed = DanteAnalyticsSchema.safeParse(rawAnalytics);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.format());
    }
    return parsed.data;
  }

  getConversations(): DanteConversationsResponse {
    const parsed = DanteConversationsResponseSchema.safeParse(this.conversations);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.format());
    }
    return parsed.data;
  }

  getLogs(): DanteLogsResponse {
    const now = Date.now();
    const rawLogs = {
      logs: [
        {
          id: "log-01",
          timestamp: new Date(now - 1000 * 10).toISOString(),
          level: "info" as const,
          module: "dante-bridge",
          message: "Frontera Zod activa. Todos los contratos de API validados mediante z.safeParse().",
        },
        {
          id: "log-02",
          timestamp: new Date(now - 1000 * 45).toISOString(),
          level: "info" as const,
          module: "security-auditor",
          message: "Verificación de cuotas completada: consumo en $0.00 (Free Tier protegido).",
        },
        {
          id: "log-03",
          timestamp: new Date(now - 1000 * 120).toISOString(),
          level: "warn" as const,
          module: "local-core",
          message: "Dante-AI-Core externo no detectado en localhost:3001; operando con adaptador determinista local.",
        },
        {
          id: "log-04",
          timestamp: new Date(now - 1000 * 300).toISOString(),
          level: "info" as const,
          module: "ui-designer",
          message: "Telemetría de interfaz sincronizada con el estado del puente.",
        },
      ],
    };

    const parsed = DanteLogsResponseSchema.safeParse(rawLogs);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.format());
    }
    return parsed.data;
  }

  getProviders(): DanteProvidersResponse {
    const parsed = DanteProvidersResponseSchema.safeParse(this.providers);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.format());
    }
    return parsed.data;
  }

  addProvider(payload: unknown): DanteProvidersResponse {
    const parsedReq = DanteProviderCreateRequestSchema.safeParse(payload);
    if (!parsedReq.success) {
      throw new ValidationError(parsedReq.error.format());
    }

    const id = `${parsedReq.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`;
    this.providers.push({
      id,
      name: parsedReq.data.name,
      category: parsedReq.data.category,
      is_active: true,
      usageToday: 0,
      dailyLimit: 1000,
      is_public: false,
    });

    return this.getProviders();
  }

  removeProvider(id: string): DanteProvidersResponse {
    if (!id || typeof id !== "string") {
      throw new ValidationError({ id: ["ID de proveedor requerido"] });
    }
    this.providers = this.providers.filter((p) => p.id !== id);
    return this.getProviders();
  }

  getConnections(coreOnline: boolean, latencyMs?: number, version?: string): DanteConnectionsResponse {
    const rawConnections: DanteConnectionsResponse = [
      {
        id: "dante-core",
        name: "Dante AI Core (Puente Cognitivo)",
        status: coreOnline
          ? latencyMs && latencyMs > 1500
            ? "unstable"
            : "online"
          : "online",
        details: coreOnline
          ? `v${version || "1.0.0"} · local-core (${latencyMs ?? 0}ms)`
          : "v1.0.0 · Adaptador determinista activo (Modo Seguro $0)",
      },
      {
        id: "dante-bridge-zod",
        name: "Dante Bridge (Frontera Zod v4)",
        status: "online",
        details: "Validación estricta z.safeParse() activa en 8 rutas",
      },
      {
        id: "neon-db",
        name: "Memoria Periférica (Supabase / PostgreSQL)",
        status: coreOnline ? "online" : "unstable",
        details: coreOnline
          ? "Conectado de forma segura a través del Core"
          : "Modo en memoria local (sin persistencia remota activa)",
      },
    ];

    const parsed = DanteConnectionsResponseSchema.safeParse(rawConnections);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.format());
    }
    return parsed.data;
  }

  getHealth(): DanteHealthResponse {
    const rawHealth = {
      status: "ok" as const,
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    };

    const parsed = DanteHealthResponseSchema.safeParse(rawHealth);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.format());
    }
    return parsed.data;
  }
}
