import { z } from "zod";

/**
 * Contrato del modelo central de conexiones, espejo del que expone Dante-AI-Core.
 * No transporta claves, tokens ni URLs internas: solo estado y metadatos.
 */

export const ConnectionTypeSchema = z.enum([
  "database",
  "auth",
  "ai_provider",
  "bridge",
  "integration",
]);

export const ConnectionStatusSchema = z.enum([
  "active",
  "incomplete",
  "disabled",
  "not_configured",
]);

export const ConnectionOwnerSchema = z.enum(["system", "user"]);

export const CoreCredentialSourceSchema = z.enum(["system", "byok", "none"]);

export const ConnectionSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  type: ConnectionTypeSchema,
  status: ConnectionStatusSchema,
  owner: ConnectionOwnerSchema,
  canToggle: z.boolean(),
  credentialSource: CoreCredentialSourceSchema,
  detail: z.string().max(200).optional(),
});

/** Estado reportado por el Core (sin filas propias de La Casa). */
export const ConnectionsStatusResponseSchema = z.object({
  generatedAt: z.string().min(1),
  storage: z.enum(["durable", "temporary"]),
  connections: z.array(ConnectionSchema),
});

export const ProviderToggleRequestSchema = z.object({
  providerId: z.string().min(1).max(64),
  enabled: z.boolean(),
});

export const AgentConnectionsResponseSchema = z.object({
  generatedAt: z.string().min(1),
  connections: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      type: ConnectionTypeSchema,
      owner: ConnectionOwnerSchema,
      status: z.literal("active"),
    }),
  ),
});

/** Origen efectivo de la credencial visto desde La Casa (sistema, BYOK o ambos). */
export const PanelCredentialSourceSchema = z.enum(["system", "byok", "both", "none"]);

export const CasaConnectionSchema = ConnectionSchema.extend({
  credentialSource: PanelCredentialSourceSchema,
  byokAvailable: z.boolean(),
});

export const ConnectionsPanelSchema = z.object({
  generatedAt: z.string().min(1),
  storage: z.enum(["durable", "temporary"]),
  bridge: z.object({
    reachable: z.boolean(),
    error: z.string().max(200).optional(),
  }),
  connections: z.array(CasaConnectionSchema),
});

export type Connection = z.infer<typeof ConnectionSchema>;
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;
export type ConnectionsStatusResponse = z.infer<typeof ConnectionsStatusResponseSchema>;
export type AgentConnectionsResponse = z.infer<typeof AgentConnectionsResponseSchema>;
export type CasaConnection = z.infer<typeof CasaConnectionSchema>;
export type ConnectionsPanel = z.infer<typeof ConnectionsPanelSchema>;
export type ProviderToggleRequest = z.infer<typeof ProviderToggleRequestSchema>;

/** Contratos del ciclo BYOK: La Casa solo ve metadatos, nunca la clave. */
export const CredentialMetadataSchema = z.object({
  credentialId: z.string().min(1),
  providerId: z.string().min(1),
  createdAt: z.string(),
  status: z.literal("active"),
});

export const CredentialStorageSchema = z.enum(["durable", "temporary"]);

export const CredentialListResponseSchema = z.object({
  credentials: z.array(CredentialMetadataSchema),
  storage: CredentialStorageSchema,
});

export const CredentialCreateResponseSchema = z.object({
  saved: z.literal(true),
  storage: CredentialStorageSchema,
  credential: CredentialMetadataSchema,
});

export const CredentialDeleteResponseSchema = z.object({
  deleted: z.literal(true),
  credentialId: z.string().min(1),
  storage: CredentialStorageSchema.optional(),
});

export type CredentialMetadata = z.infer<typeof CredentialMetadataSchema>;
export type CredentialStorage = z.infer<typeof CredentialStorageSchema>;
export type CredentialListResponse = z.infer<typeof CredentialListResponseSchema>;
export type CredentialCreateResponse = z.infer<typeof CredentialCreateResponseSchema>;
export type CredentialDeleteResponse = z.infer<typeof CredentialDeleteResponseSchema>;
