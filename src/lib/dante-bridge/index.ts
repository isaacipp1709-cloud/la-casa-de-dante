import {
  DanteChatResponse,
  DanteNeuronsResponse,
  DanteAnalytics,
  DanteConversationsResponse,
  DanteLogsResponse,
  DanteProvidersResponse,
  DanteConnectionsResponse,
  DanteHealthResponse,
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
import type { BridgeStatus, DanteBridgeState } from "@/contracts/dante";
import { MockDanteProvider } from "./mock-provider";
import { ValidationError } from "./errors";
import {
  chatWithDanteWithRetry,
  checkDanteHealth,
  fetchFromDanteCore,
} from "./client";

export interface DanteBridge {
  chat(request: unknown): Promise<DanteChatResponse>;
  getStatus(): BridgeStatus;
  getHealth(): Promise<DanteHealthResponse>;
  getNeurons(): Promise<DanteNeuronsResponse>;
  getAnalytics(): Promise<DanteAnalytics>;
  getConversations(): Promise<DanteConversationsResponse>;
  getLogs(): Promise<DanteLogsResponse>;
  getProviders(): Promise<DanteProvidersResponse>;
  addProvider(payload: unknown): Promise<DanteProvidersResponse>;
  removeProvider(id: string): Promise<DanteProvidersResponse>;
  getConnections(): Promise<DanteConnectionsResponse>;
}

export class DanteBridgeImpl implements DanteBridge {
  private provider: MockDanteProvider;
  private status: BridgeStatus;

  constructor() {
    this.provider = new MockDanteProvider();
    this.status = {
      state: 'LOADING',
      lastCheckedAt: new Date().toISOString(),
    };
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
    return process.env.DANTE_MODE === 'local-core';
  }

  async chat(payload: unknown): Promise<DanteChatResponse> {
    const parsedRequest = DanteChatRequestSchema.safeParse(payload);

    if (!parsedRequest.success) {
      throw new ValidationError(parsedRequest.error.format());
    }

    this.setStatus('LOADING');

    // Server-side toggle: local-core uses the real orchestrator
    if (this.isLocalCoreMode()) {
      try {
        const conversationId = parsedRequest.data.conversationId
          || parsedRequest.data.sessionId
          || `local-${Date.now()}`;

        const ctx = parsedRequest.data.context;
        let previousMessages: { role: 'user' | 'assistant' | 'system'; content: string; timestamp?: string }[] = [];

        try {
          const rawHistory = await fetchFromDanteCore(
            `/api/conversations/${conversationId}/messages`,
            3000
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

        const coreResponse = await chatWithDanteWithRetry(messages, {
          'X-User-Timezone': ctx?.timezone || 'America/Santiago',
          'X-User-Locale': ctx?.locale || 'es-CL',
          'X-User-ID': parsedRequest.data.userId || '',
          'X-Conversation-ID': conversationId,
        });

        this.setStatus('CONNECTED');

        const mappedResponse: DanteChatResponse = {
          message: {
            role: coreResponse.choices[0].message.role as "assistant" | "user" | "system",
            content: coreResponse.choices[0].message.content,
          },
          status: "success",
          correlationId: coreResponse.conversationId || coreResponse.id,
          providerId: coreResponse.model,
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

        return validatedResponse.data;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'UNKNOWN';
        const bridgeState: DanteBridgeState =
          errorMsg === 'TIMEOUT' ? 'DEGRADED' : 'ERROR';
        this.setStatus(bridgeState, errorMsg);
        throw error;
      }
    }

    // Mock mode: Core not involved
    this.setStatus('DISCONNECTED');
    const response = await this.provider.processChat(parsedRequest.data);
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

  async getConversations(): Promise<DanteConversationsResponse> {
    if (this.isLocalCoreMode()) {
      try {
        const data = await fetchFromDanteCore('/api/conversations');
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
    if (this.isLocalCoreMode()) {
      try {
        const data = await fetchFromDanteCore('/api/logs');
        const parsed = DanteLogsResponseSchema.safeParse(data);
        if (parsed.success) {
          this.setStatus('CONNECTED');
          return parsed.data;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'UNKNOWN';
        this.setStatus('DEGRADED', errorMsg);
      }
    }
    return this.provider.getLogs();
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
}

// Singleton para uso directo
export const danteBridge = new DanteBridgeImpl();
