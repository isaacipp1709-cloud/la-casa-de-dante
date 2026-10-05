import { z } from "zod";

export const DanteMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
  timestamp: z.string().datetime().optional(),
});

export const DanteChatRequestSchema = z.object({
  messages: z.array(DanteMessageSchema).min(1),
  sessionId: z.string().optional(),
  conversationId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
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
