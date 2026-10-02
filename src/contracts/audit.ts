import { z } from "zod";

export const AuditEventSchema = z.object({
  correlationId: z.string().min(1),
  provider: z.literal("mock"),
  status: z.enum(["success", "error"]),
  durationMs: z.number().int().nonnegative(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
