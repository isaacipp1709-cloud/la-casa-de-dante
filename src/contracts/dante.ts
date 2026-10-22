import { z } from "zod";

export const DanteMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
  timestamp: z.string().datetime().optional(),
  providerId: z.string().optional(),
  model: z.string().optional(),
  archetypeId: z.string().optional(),
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
  providerId: z.string().optional(),
  credentialId: z.string().optional(), // BYOK: reference to stored credential, never the key
  model: z.string().optional(),
  archetypeId: z.string().optional(),
});

export const DanteChatResponseSchema = z.object({
  message: DanteMessageSchema,
  status: z.enum(["success", "error"]),
  correlationId: z.string(),
  providerId: z.string().optional(),
  model: z.string().optional(),
  archetypeId: z.string().optional(),
  persistence: z.enum(["saved", "unavailable", "disabled"]).optional(),
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

const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

function parseAndNormalizeTimestamp(input: string | Date): string | null {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input.toISOString();
  }
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  const match = TIMESTAMP_PATTERN.exec(trimmed);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;

  const utcCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    utcCheck.getUTCFullYear() !== year ||
    utcCheck.getUTCMonth() !== month - 1 ||
    utcCheck.getUTCDate() !== day
  ) {
    return null;
  }

  let offset = match[8] ?? "Z";
  if (/^[+-]\d{2}$/.test(offset)) {
    offset = `${offset}:00`;
  } else if (/^[+-]\d{4}$/.test(offset)) {
    offset = `${offset.slice(0, 3)}:${offset.slice(3)}`;
  }

  const frac = match[7] ? `.${match[7].slice(0, 3).padEnd(3, "0")}` : "";
  const isoCandidate = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${frac}${offset}`;
  const parsedMs = Date.parse(isoCandidate);
  if (Number.isNaN(parsedMs)) return null;

  return new Date(parsedMs).toISOString();
}

export const DanteTimestampSchema = z
  .union([z.string(), z.date()])
  .refine((val) => parseAndNormalizeTimestamp(val) !== null, {
    message: "Marca temporal inválida; se requiere fecha ISO-8601 o TIMESTAMPTZ válida",
  })
  .transform((val) => parseAndNormalizeTimestamp(val)!);

export const DanteConversationSchema = z.object({
  id: z.string().min(1),
  external_id: z.string().min(1).optional(),
  title: z.string().optional(),
  updated_at: DanteTimestampSchema,
});

export const DanteConversationsResponseSchema = z.array(DanteConversationSchema);

export const DanteConversationMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  created_at: DanteTimestampSchema.optional(),
  timestamp: DanteTimestampSchema.optional(),
});

export const DanteConversationMessagesResponseSchema = z.array(DanteConversationMessageSchema);

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
  models: z.array(z.string()).default([]),
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