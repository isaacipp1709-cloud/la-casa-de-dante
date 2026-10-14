import { z } from "zod";

export const AuditEventSchema = z.object({
  correlationId: z.string().min(1),
  provider: z.enum(["mock", "local-core", "gemini", "huggingface", "ollama"]),
  status: z.enum(["success", "error"]),
  durationMs: z.number().int().nonnegative(),
  route: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
