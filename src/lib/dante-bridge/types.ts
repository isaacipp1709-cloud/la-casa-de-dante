import { z } from "zod";
import {
  DanteMessageSchema,
  DanteChatRequestSchema,
  DanteChatResponseSchema,
  DanteHealthResponseSchema,
  DanteNeuronSchema,
  DanteNeuronsResponseSchema,
  DanteAnalyticsSchema,
  DanteConversationSchema,
  DanteConversationsResponseSchema,
  DanteConversationMessageSchema,
  DanteConversationMessagesResponseSchema,
  DanteLogEntrySchema,
  DanteLogsResponseSchema,
  DanteProviderStatusSchema,
  DanteProvidersResponseSchema,
  DanteProviderCreateRequestSchema,
  DanteConnectionSchema,
  DanteConnectionsResponseSchema,
  DanteDocumentIngestionRequestSchema,
  DanteIngestedDocumentSchema,
  DanteDocumentIngestionResponseSchema,
} from "@/contracts/dante";

export type DanteMessage = z.infer<typeof DanteMessageSchema>;
export type DanteChatRequest = z.infer<typeof DanteChatRequestSchema>;
export type DanteChatResponse = z.infer<typeof DanteChatResponseSchema>;
export type DanteHealthResponse = z.infer<typeof DanteHealthResponseSchema>;
export type DanteNeuron = z.infer<typeof DanteNeuronSchema>;
export type DanteNeuronsResponse = z.infer<typeof DanteNeuronsResponseSchema>;
export type DanteAnalytics = z.infer<typeof DanteAnalyticsSchema>;
export type DanteConversation = z.infer<typeof DanteConversationSchema>;
export type DanteConversationsResponse = z.infer<typeof DanteConversationsResponseSchema>;
export type DanteConversationMessage = z.infer<typeof DanteConversationMessageSchema>;
export type DanteConversationMessagesResponse = z.infer<typeof DanteConversationMessagesResponseSchema>;
export type DanteLogEntry = z.infer<typeof DanteLogEntrySchema>;
export type DanteLogsResponse = z.infer<typeof DanteLogsResponseSchema>;
export type DanteProviderStatus = z.infer<typeof DanteProviderStatusSchema>;
export type DanteProvidersResponse = z.infer<typeof DanteProvidersResponseSchema>;
export type DanteProviderCreateRequest = z.infer<typeof DanteProviderCreateRequestSchema>;
export type DanteConnection = z.infer<typeof DanteConnectionSchema>;
export type DanteConnectionsResponse = z.infer<typeof DanteConnectionsResponseSchema>;
export type DanteDocumentIngestionRequest = z.infer<typeof DanteDocumentIngestionRequestSchema>;
export type DanteIngestedDocument = z.infer<typeof DanteIngestedDocumentSchema>;
export type DanteDocumentIngestionResponse = z.infer<typeof DanteDocumentIngestionResponseSchema>;
