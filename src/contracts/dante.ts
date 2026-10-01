import { z } from "zod";

export const DanteMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
  timestamp: z.string().datetime().optional(),
});

export const DanteChatRequestSchema = z.object({
  messages: z.array(DanteMessageSchema).min(1),
  sessionId: z.string().optional(),
});

export const DanteChatResponseSchema = z.object({
  message: DanteMessageSchema,
  status: z.enum(["success", "error"]),
  correlationId: z.string(),
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
