import { z } from "zod";
import {
  DanteMessageSchema,
  DanteChatRequestSchema,
  DanteChatResponseSchema,
  DanteHealthResponseSchema,
} from "@/contracts/dante";

export type DanteMessage = z.infer<typeof DanteMessageSchema>;
export type DanteChatRequest = z.infer<typeof DanteChatRequestSchema>;
export type DanteChatResponse = z.infer<typeof DanteChatResponseSchema>;
export type DanteHealthResponse = z.infer<typeof DanteHealthResponseSchema>;
