import { randomUUID } from "node:crypto";
import { ownerAssertionHeaders } from "@/lib/credentials/owner-assertion";
import { isCoreMode } from "./bridge-mode";
import { buildCoreChatHeaders } from "./chat-headers";
import {
  DanteChatResponse,
  DanteNeuronsResponse,
  DanteAnalytics,
  DanteConversationsResponse,
  DanteLogsResponse,
  DanteProvidersResponse,
  DanteConnectionsResponse,
  DanteHealthResponse,
  DanteDocumentIngestionResponse,
} from "./types";
import {
  DanteChatRequestSchema,
  DanteChatResponseSchema,
  DanteNeuronsResponseSchema,
  DanteAnalyticsSchema,
  DanteConversationsResponseSchema,
  DanteLogsResponseSchema,
  DanteProvidersResponseSchema,
  DanteConnectionsResponseSchema,
  DanteHealthResponseSchema,
} from "@/contracts/dante";
import type {
  ConnectionsStatusResponse,
  AgentConnectionsResponse,
  CredentialStorage,
} from "@/contracts/connections";
import {
  ConnectionsStatusResponseSchema,
  AgentConnectionsResponseSchema,
  CredentialListResponseSchema,
  CredentialCreateResponseSchema,
  CredentialDeleteResponseSchema,
} from "@/contracts/connections";
import type { BridgeStatus, DanteBridgeState } from "@/contracts/dante";
import { MockDanteProvider } from "./mock-provider";
import { ValidationError } from "./errors";
import {
  chatWithDanteWithRetry,
  checkDanteHealth,
  fetchFromDanteCore,  postToDanteCore,
  deleteFromDanteCore,
} from "./client";
import {
  AuditLogPort,
  InMemoryAuditLogAdapter,
} from "@/lib/orchestrator/ports/audit-log.port";
import {
  CorrelationIdGenerator,
  DeterministicCorrelationIdGenerator,
} from "@/lib/orchestrator/ports/correlation-id.port";
import { LlmGatewayPort } from "@/lib/orchestrator/ports/llm-gateway.port";

export interface DanteBridge {
  chat(request: unknown): Promise<DanteChatResponse>;
  getStatus(): BridgeStatus;
  getHealth(): Promise<DanteHealthResponse>;
  getNeurons(): Promise<DanteNeuronsResponse>;
  getAnalytics(): Promise<DanteAnalytics>;
  getConversations(ownerId?: string): Promise<DanteConversationsResponse>;
  getLogs(): Promise<DanteLogsResponse>;
  getProviders(): Promise<DanteProvidersResponse>;
  addProvider(payload: unknown): Promise<DanteProvidersResponse>;
  removeProvider(id: string): Promise<DanteProvidersResponse>;
  getConnections(): Promise<DanteConnectionsResponse>;
  getIngestedDocuments(): Promise<DanteDocumentIngestionResponse>;
  ingestDocument(payload: unknown): Promise<DanteDocumentIngestionResponse>;
  getConnectionsStatus(): Promise<ConnectionsStatusResponse>;
  toggleProviderConnection(providerId: string, enabled: boolean, ownerId?: string): Promise<ConnectionsStatusResponse>;
  getAvailableConnections(): Promise<AgentConnectionsResponse>;
  createCredential(input: { ownerId: string; providerId: string; apiKey: string }): Promise<{ storage: CredentialStorage; credential: { credentialId: string; providerId: string; createdAt: string; status: "active" } }>;
  listCredentials(ownerId: string): Promise<{ storage: CredentialStorage; credentials: Array<{ credentialId: string; providerId: string; createdAt: string; status: "active" }> }>;
  deleteCredential(ownerId: string, credentialId: string): Promise<{ storage: CredentialStorage; credentialId: string }>;
  chatWithStoredCredential(input: { ownerId: string; credentialId: string; messages: Array<{ role: "user" | "assistant" | "system"; content: string }>; model?: string; conversationId?: string; timezone?: string; locale?: string }): Promise<DanteChatResponse>;
}

export class DanteBridgeImpl implements DanteBridge, LlmGatewayPort {
  private provider: MockDanteProvider;
  private status: BridgeStatus;
  private auditLog: AuditLogPort;
  private correlationGen: CorrelationIdGenerator;

  constructor(
    auditLog: AuditLogPort = new InMemoryAuditLogAdapter(),
    correlationGen: CorrelationIdGenerator = new DeterministicCorrelationIdGenerator()
  ) {
    this.provider = new MockDanteProvider();
    this.auditLog = auditLog;
    this.correlationGen = correlationGen;
    this.status = {
      state: 'LOADING',
      lastCheckedAt: new Date().toISOString(),
    };
  }

  async complete(request: unknown): Promise<DanteChatResponse> {
    return this.chat(request);
  }

  getStatus(): BridgeStatus {
    return this.status;
  }

  private setStatus(state: DanteBridgeState, error?: string): void {
    this.status = {
      state,
      lastCheckedAt: new Date().toISOString(),
      ...(error ? { error } : {}),
    };
  }

  private isLocalCoreMode(): boolean {
    return isCoreMode();
  }

  async chat(payload: unknown, options?: { verifiedOwnerId?: string }): Promise<DanteChatResponse> {
    const startTime = Date.now();
    const parsedRequest = DanteChatRequestSchema.safeParse(payload);

    if (!parsedRequest.success) {
      this.auditLog.record({
        correlationId: this.correlationGen.next("invalid-req"),
        provider: "mock",
        status: "error",
        durationMs: Date.now() - startTime,
        route: "/api/chat",
      });
      throw new ValidationError(parsedRequest.error.format());
    }

    this.setStatus('LOADING');

    // Server-side toggle: local-core uses the real orchestrator
    if (this.isLocalCoreMode()) {
      try {
        const conversationId = parsedRequest.data.conversationId?.trim()
          || parsedRequest.data.sessionId?.trim()
          || this.correlationGen.next("local");

        const ctx = parsedRequest.data.context;
        let previousMessages: { role: 'user' | 'assistant' | 'system'; content: string; timestamp?: string }[] = [];

        try {
          const rawHistory = await fetchFromDanteCore(
            `/api/conversations/${conversationId}/messages`,
            3000,
            options?.verifiedOwnerId ? ownerAssertionHeaders(options.verifiedOwnerId) : undefined
          );
          if (Array.isArray(rawHistory)) {
            previousMessages = rawHistory;
          }
        } catch (e) {
          console.error("Failed to fetch message history:", e);
        }

        const messages = [
          ...previousMessages,
          ...parsedRequest.data.messages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp
          }))
        ];

        // Identidad verificada en el servidor de La Casa; nunca la del navegador.
        const coreHeaders = buildCoreChatHeaders({
          verifiedOwnerId: String(options?.verifiedOwnerId ?? ''),
          conversationId,
          timezone: ctx?.timezone,
          locale: ctx?.locale,
        });

        const coreResponse = await chatWithDanteWithRetry(messages, coreHeaders);

        this.setStatus('CONNECTED');

        const rawContent = coreResponse.choices[0]?.message?.content ?? "";
        const isCoreFallbackMock =
          coreResponse.model === "mock" ||
          coreResponse.model === "mock-dante" ||
          rawContent.trim().startsWith("[Fallback Mock]");

        if (isCoreFallbackMock) {
          let financialCalculations: Record<string, unknown> | undefined;
          const calcMatch = rawContent.match(
            /\[System Context:\s*Financial calculations:\s*(\{[\s\S]*?\})\]/i
          );
          if (calcMatch?.[1]) {
            try {
              const parsedCalc = JSON.parse(calcMatch[1]);
              if (parsedCalc && typeof parsedCalc === "object") {
                financialCalculations = parsedCalc as Record<string, unknown>;
              }
            } catch {
              // Ignorar si el bloque JSON de contexto no es parseable
            }
          }

          const synthesized = await this.provider.processChat(parsedRequest.data, {
            financialCalculations,
            fromCoreFallback: true,
          });

          const enrichedResponse: DanteChatResponse = {
            ...synthesized,
            correlationId:
              coreResponse.conversationId || coreResponse.id || synthesized.correlationId,
          };

          const validatedFallback = DanteChatResponseSchema.safeParse(enrichedResponse);
          if (!validatedFallback.success) {
            throw new ValidationError(validatedFallback.error.format());
          }

          this.auditLog.record({
            correlationId: validatedFallback.data.correlationId,
            provider: "local-core",
            status: "success",
            durationMs: Date.now() - startTime,
            route: "/api/chat",
          });

          return validatedFallback.data;
        }

        const cleanedContent = rawContent
          .replace(/\n*\[System Context:\s*Financial calculations:\s*\{\s*\}\]/gi, "")
          .trim();

        const rawPersistence = coreResponse.persistence;
        const persistence: 'saved' | 'unavailable' | 'disabled' | undefined =
          rawPersistence === 'saved' || rawPersistence === 'unavailable' || rawPersistence === 'disabled'
            ? rawPersistence
            : undefined;

        const mappedResponse: DanteChatResponse = {
          message: {
            role: coreResponse.choices[0].message.role as "assistant" | "user" | "system",
            content: cleanedContent || rawContent,
          },
          status: "success",
          correlationId: coreResponse.conversationId || coreResponse.id || conversationId,
          providerId: coreResponse.model,
          persistence,
          usage: coreResponse.usage ? {
            promptTokens: coreResponse.usage.prompt_tokens,
            completionTokens: coreResponse.usage.completion_tokens,
            totalTokens: coreResponse.usage.total_tokens
          } : undefined
        };

        const validatedResponse = DanteChatResponseSchema.safeParse(mappedResponse);
        if (!validatedResponse.success) {
          throw new ValidationError(validatedResponse.error.format());
        }

        this.auditLog.record({
          correlationId: validatedResponse.data.correlationId,
          provider: "local-core",
          status: "success",
          durationMs: Date.now() - startTime,
          route: "/api/chat",
        });

        return validatedResponse.data;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'UNKNOWN';
        const bridgeState: DanteBridgeState =
          errorMsg === 'TIMEOUT' ? 'DEGRADED' : 'ERROR';
        this.setStatus(bridgeState, errorMsg);
        this.auditLog.record({
          correlationId: this.correlationGen.next("core-err"),
          provider: "local-core",
          status: "error",
          durationMs: Date.now() - startTime,
          route: "/api/chat",
        });
        throw error;
      }
    }

    // Mock mode: Core not involved
    this.setStatus('DISCONNECTED');
    const response = await this.provider.processChat(parsedRequest.data);
    this.auditLog.record({
      correlationId: response.correlationId,
      provider: "mock",
      status: "success",
      durationMs: Date.now() - startTime,
      route: "/api/chat",
    });
    return response;
  }

  async getHealth(): Promise<DanteHealthResponse> {
    if (this.isLocalCoreMode()) {
      try {
        const coreHealth = await checkDanteHealth(4000);
        const candidate = {
          status:
            coreHealth.status === "ok" || coreHealth.status === "degraded" || coreHealth.status === "down"
              ? coreHealth.status
              : ("ok" as const),
          version: coreHealth.version || "1.0.0",
          timestamp: new Date().toISOString(),
        };
        const parsed = DanteHealthResponseSchema.safeParse(candidate);
        if (parsed.success) {
          this.setStatus('CONNECTED');
          return parsed.data;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'UNKNOWN';
        this.setStatus('DEGRADED', errorMsg);
      }
    }

    return this.provider.getHealth();
  }

  async getNeurons(): Promise<DanteNeuronsResponse> {
    if (this.isLocalCoreMode()) {
      try {
        const data = await fetchFromDanteCore('/api/neurons');
        const parsed = DanteNeuronsResponseSchema.safeParse(data);
        if (parsed.success) {
          this.setStatus('CONNECTED');
          return parsed.data;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'UNKNOWN';
        this.setStatus('DEGRADED', errorMsg);
      }
    }
    return this.provider.getNeurons();
  }

  async getAnalytics(): Promise<DanteAnalytics> {
    if (this.isLocalCoreMode()) {
      try {
        const data = await fetchFromDanteCore('/api/analytics');
        const parsed = DanteAnalyticsSchema.safeParse(data);
        if (parsed.success) {
          this.setStatus('CONNECTED');
          return parsed.data;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'UNKNOWN';
        this.setStatus('DEGRADED', errorMsg);
      }
    }
    return this.provider.getAnalytics();
  }

  async getConversations(ownerId?: string): Promise<DanteConversationsResponse> {
    if (this.isLocalCoreMode()) {
      try {
        const assertion = ownerId ? ownerAssertionHeaders(ownerId) : undefined;
        const data = await fetchFromDanteCore('/api/conversations', 8_000, assertion);
        const parsed = DanteConversationsResponseSchema.safeParse(data);
        if (parsed.success) {
          this.setStatus('CONNECTED');
          return parsed.data;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'UNKNOWN';
        this.setStatus('DEGRADED', errorMsg);
      }
    }
    return this.provider.getConversations();
  }

  async getLogs(): Promise<DanteLogsResponse> {
    const recentAudit = this.auditLog.getRecentLogs();
    if (this.isLocalCoreMode()) {
      try {
        const data = await fetchFromDanteCore('/api/logs');
        const parsed = DanteLogsResponseSchema.safeParse(data);
        if (parsed.success) {
          this.setStatus('CONNECTED');
          return {
            logs: [...recentAudit, ...parsed.data.logs],
          };
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'UNKNOWN';
        this.setStatus('DEGRADED', errorMsg);
      }
    }
    const baseLogs = this.provider.getLogs();
    const merged = {
      logs: [...recentAudit, ...baseLogs.logs],
    };
    const validated = DanteLogsResponseSchema.safeParse(merged);
    if (!validated.success) {
      throw new ValidationError(validated.error.format());
    }
    return validated.data;
  }

  async getProviders(): Promise<DanteProvidersResponse> {
    if (this.isLocalCoreMode()) {
      try {
        const data = (await fetchFromDanteCore('/api/providers/status')) as {
          providers?: unknown;
        };
        const rawList = Array.isArray(data?.providers) ? data.providers : data;
        const parsed = DanteProvidersResponseSchema.safeParse(rawList);
        if (parsed.success) {
          this.setStatus('CONNECTED');
          return parsed.data;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'UNKNOWN';
        this.setStatus('DEGRADED', errorMsg);
      }
    }
    return this.provider.getProviders();
  }

  async addProvider(payload: unknown): Promise<DanteProvidersResponse> {
    return this.provider.addProvider(payload);
  }

  async removeProvider(id: string): Promise<DanteProvidersResponse> {
    return this.provider.removeProvider(id);
  }

  async getConnections(): Promise<DanteConnectionsResponse> {
    if (this.isLocalCoreMode()) {
      const start = Date.now();
      try {
        const health = await checkDanteHealth(4000);
        const latency = Date.now() - start;
        this.setStatus('CONNECTED');
        return this.provider.getConnections(true, latency, health.version);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error de conexión (Timeout)';
        this.setStatus('DEGRADED', errorMsg);
        const fallback: DanteConnectionsResponse = [
          {
            id: 'dante-core',
            name: 'Dante AI Core (local-core)',
            status: 'offline',
            details: `No disponible (${errorMsg}) — Respaldo local activo`,
          },
          {
            id: 'dante-bridge-zod',
            name: 'Dante Bridge (Frontera Zod v4)',
            status: 'online',
            details: 'Validación estricta z.safeParse() activa',
          },
          {
            id: 'neon-db',
            name: 'Neon Database (PostgreSQL)',
            status: 'offline',
            details: 'Desconectado',
          },
        ];
        const parsed = DanteConnectionsResponseSchema.safeParse(fallback);
        if (!parsed.success) {
          throw new ValidationError(parsed.error.format());
        }
        return parsed.data;
      }
    }

    return this.provider.getConnections(false);
  }

  async getIngestedDocuments(): Promise<DanteDocumentIngestionResponse> {
    return this.provider.getIngestedDocuments();
  }

  async ingestDocument(payload: unknown): Promise<DanteDocumentIngestionResponse> {
    const startTime = Date.now();
    try {
      const result = this.provider.ingestDocument(payload);
      this.auditLog.record({
        correlationId: this.correlationGen.next("ingest"),
        provider: "mock",
        status: "success",
        durationMs: Date.now() - startTime,
        route: "/api/connections",
      });
      return result;
    } catch (error) {
      this.auditLog.record({
        correlationId: this.correlationGen.next("ingest-err"),
        provider: "mock",
        status: "error",
        durationMs: Date.now() - startTime,
        route: "/api/connections",
      });
      throw error;
    }
  }
  /** Estado real de conexiones reportado por el Core (o el mock local). */
  async getConnectionsStatus(): Promise<ConnectionsStatusResponse> {
    if (this.isLocalCoreMode()) {
      try {
        const data = await fetchFromDanteCore('/api/connections/status');
        const parsed = ConnectionsStatusResponseSchema.safeParse(data);
        if (parsed.success) {
          this.setStatus('CONNECTED');
          return parsed.data;
        }
      } catch (error) {
        this.setStatus('DEGRADED', error instanceof Error ? error.message : 'UNKNOWN');
      }
    }
    return this.provider.getConnectionsStatus();
  }

  /** Activa o desactiva un proveedor. No elimina credenciales. */
  async toggleProviderConnection(
    providerId: string,
    enabled: boolean,
    ownerId?: string,
  ): Promise<ConnectionsStatusResponse> {
    if (this.isLocalCoreMode()) {
      try {
        const assertion = ownerId ? ownerAssertionHeaders(ownerId) : undefined;
        const data = await postToDanteCore(
          '/api/connections/providers/toggle',
          { providerId, enabled },
          8_000,
          assertion,
        );
        const parsed = ConnectionsStatusResponseSchema.safeParse(data);
        if (parsed.success) {
          this.setStatus('CONNECTED');
          return parsed.data;
        }
      } catch (error) {
        this.setStatus('DEGRADED', error instanceof Error ? error.message : 'UNKNOWN');
      }
    }
    return this.provider.toggleProviderConnection(providerId, enabled);
  }

  /** Subconjunto seguro para agentes: solo conexiones activas. */
  async getAvailableConnections(): Promise<AgentConnectionsResponse> {
    if (this.isLocalCoreMode()) {
      try {
        const data = await fetchFromDanteCore('/api/connections/available');
        const parsed = AgentConnectionsResponseSchema.safeParse(data);
        if (parsed.success) {
          this.setStatus('CONNECTED');
          return parsed.data;
        }
      } catch (error) {
        this.setStatus('DEGRADED', error instanceof Error ? error.message : 'UNKNOWN');
      }
    }
    return this.provider.getAvailableConnections();
  }

  /** Crea una credencial BYOK en el Core (cifrada alli; nunca en La Casa). */
  async createCredential(input: { ownerId: string; providerId: string; apiKey: string }) {
    const assertion = ownerAssertionHeaders(input.ownerId);
    if (Object.keys(assertion).length === 0) {
      throw new ValidationError({ identity: ['Identidad del usuario no disponible'] });
    }
    const data = await postToDanteCore(
      '/api/credentials',
      { providerId: input.providerId, apiKey: input.apiKey },
      8_000,
      assertion,
    );
    const parsed = CredentialCreateResponseSchema.safeParse(data);
    if (!parsed.success) throw new ValidationError(parsed.error.format());
    return { storage: parsed.data.storage, credential: parsed.data.credential };
  }

  /** Lista solo metadatos del propietario; el Core aplica el aislamiento. */
  async listCredentials(ownerId: string) {
    const assertion = ownerAssertionHeaders(ownerId);
    if (Object.keys(assertion).length === 0) {
      throw new ValidationError({ identity: ['Identidad del usuario no disponible'] });
    }
    const data = await fetchFromDanteCore('/api/credentials', 8_000, assertion);
    const parsed = CredentialListResponseSchema.safeParse(data);
    if (!parsed.success) throw new ValidationError(parsed.error.format());
    return { storage: parsed.data.storage, credentials: parsed.data.credentials };
  }

  /** Elimina una credencial propia en el Core. */
  async deleteCredential(ownerId: string, credentialId: string) {
    const assertion = ownerAssertionHeaders(ownerId);
    if (Object.keys(assertion).length === 0) {
      throw new ValidationError({ identity: ['Identidad del usuario no disponible'] });
    }
    const data = await deleteFromDanteCore(
      `/api/credentials/${encodeURIComponent(credentialId)}`,
      assertion,
    );
    const parsed = CredentialDeleteResponseSchema.safeParse(data);
    if (!parsed.success) throw new ValidationError(parsed.error.format());
    return {
      storage: parsed.data.storage ?? ('temporary' as CredentialStorage),
      credentialId: parsed.data.credentialId,
    };
  }

  /** Ejecuta el chat con la credencial resuelta en el Core (nunca aqui). */
  async chatWithStoredCredential(input: {
    ownerId: string;
    credentialId: string;
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
    model?: string;
    conversationId?: string;
    timezone?: string;
    locale?: string;
  }): Promise<DanteChatResponse> {
    const assertion = ownerAssertionHeaders(input.ownerId);
    if (Object.keys(assertion).length === 0) {
      throw new ValidationError({ identity: ['Identidad del usuario no disponible'] });
    }
    const resolvedConversationId = input.conversationId?.trim() || randomUUID();
    const data = (await postToDanteCore(
      '/api/chat',
      {
        messages: input.messages,
        credentialId: input.credentialId,
        model: input.model,
      },
      30_000,
      {
        ...assertion,
        'X-User-Timezone': input.timezone || 'America/Santiago',
        'X-User-Locale': input.locale || 'es-CL',
        'X-Conversation-ID': resolvedConversationId,
      },
    )) as {
      id?: string;
      model?: string;
      conversationId?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      choices?: Array<{ message?: { role?: string; content?: string } }>;
      persistence?: string;
    };

    const rawContent = data?.choices?.[0]?.message?.content ?? '';
    const rawPersistence = data?.persistence;
    const persistence: 'saved' | 'unavailable' | 'disabled' | undefined =
      rawPersistence === 'saved' || rawPersistence === 'unavailable' || rawPersistence === 'disabled'
        ? rawPersistence
        : undefined;

    const mapped: DanteChatResponse = {
      message: {
        role: (data?.choices?.[0]?.message?.role as 'assistant' | 'user' | 'system') || 'assistant',
        content: rawContent,
      },
      status: 'success',
      correlationId: data?.conversationId || data?.id || resolvedConversationId,
      providerId: data?.model,
      persistence,
      usage: data?.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
          }
        : undefined,
    };

    const validated = DanteChatResponseSchema.safeParse(mapped);
    if (!validated.success) throw new ValidationError(validated.error.format());
    this.setStatus('CONNECTED');
    return validated.data;
  }

}

// Singleton para uso directo
export const danteBridge = new DanteBridgeImpl();
