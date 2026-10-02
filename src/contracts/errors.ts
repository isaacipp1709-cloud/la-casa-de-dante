import { z } from "zod";

export const PublicErrorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "VALIDATION_ERROR",
  "INTERNAL_ERROR",
]);

export const PublicErrorSchema = z.object({
  code: PublicErrorCodeSchema,
  message: z.string().min(1),
});

export type PublicErrorCode = z.infer<typeof PublicErrorCodeSchema>;
export type PublicError = z.infer<typeof PublicErrorSchema>;
