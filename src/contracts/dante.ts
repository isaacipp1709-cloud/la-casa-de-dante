import { z } from "zod";

export const DanteMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
  timestamp: z.string().datetime().optional(),
});

export const DanteChatMessageSchema = DanteMessageSchema;

export const DanteChatRequestSchema = z.object({
  messages: z.array(DanteMessageSchema).min(1),
  sessionId: z.string().optional(),
  conversationId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  context: z.object({
    timezone: z.string().default('UTC'),
    locale: z.string().default('es-CL'),
    capabilities: z.array(z.string()).optional(),
    constraints: z.array(z.string()).optional(),
  }).optional(),
});

export const DanteChatResponseSchema = z.object({
  message: DanteMessageSchema,
  status: z.enum(["success", "error"]),
  correlationId: z.string(),
  providerId: z.string().optional(),
  usage: z.object({
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  }).optional(),
});

export const DanteHealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  version: z.string(),
  timestamp: z.string().datetime(),
});

export const DanteNeuronSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["activo", "en_espera", "degradado"]),
  category: z.string().min(1),
  description: z.string().min(1),
  lastExecution: z.string().datetime(),
  latencyMs: z.number().nonnegative().optional(),
  activationsToday: z.number().int().nonnegative().optional(),
});

export const DanteNeuronsResponseSchema = z.array(DanteNeuronSchema);

export const DanteAnalyticsSchema = z.object({
  totalConversations: z.number().int().nonnegative(),
  totalMessages: z.number().int().nonnegative(),
  averageLatencyMs: z.number().nonnegative(),
});

export const DanteConversationSchema = z.object({
  id: z.string().min(1),
  external_id: z.string().optional(),
  updated_at: z.string().datetime(),
});

export const DanteConversationsResponseSchema = z.array(DanteConversationSchema);

export const DanteLogEntrySchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().datetime(),
  level: z.enum(["info", "warn", "error"]),
  module: z.string().min(1),
  message: z.string().min(1),
});

export const DanteLogsResponseSchema = z.object({
  logs: z.array(DanteLogEntrySchema),
});

export const DanteProviderStatusSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  is_active: z.boolean(),
  usageToday: z.number().int().nonnegative().default(0),
  dailyLimit: z.number().int().nonnegative().default(1000),
  is_public: z.boolean().default(false),
});

export const DanteProvidersResponseSchema = z.array(DanteProviderStatusSchema);

export const DanteProviderCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(40),
});

export const DanteConnectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["online", "unstable", "offline"]),
  details: z.string().min(1),
});

export const DanteConnectionsResponseSchema = z.array(DanteConnectionSchema);

export const DanteDocumentIngestionRequestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(10).max(50000),
  category: z.enum(["arquitectura", "seguridad", "memoria", "general"]).default("arquitectura"),
});

export const DanteIngestedDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.enum(["arquitectura", "seguridad", "memoria", "general"]),
  chunksCount: z.number().int().positive(),
  charCount: z.number().int().positive(),
  ingestedAt: z.string().datetime(),
  neuronHandler: z.literal("N26 · Ingestor Semántico Documental"),
});

export const DanteDocumentIngestionResponseSchema = z.array(DanteIngestedDocumentSchema);

// Bridge state machine
export type DanteBridgeState =
  | 'CONNECTED'
  | 'DEGRADED'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'LOADING';

export interface BridgeStatus {
  state: DanteBridgeState;
  lastCheckedAt: string;
  error?: string;
}
