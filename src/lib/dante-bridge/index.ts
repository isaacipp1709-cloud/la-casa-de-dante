import { DanteChatResponse } from "./types";
import { DanteChatRequestSchema } from "@/contracts/dante";
import type { BridgeStatus, DanteBridgeState } from "@/contracts/dante";
import { MockDanteProvider } from "./mock-provider";
import { ValidationError } from "./errors";
import { chatWithDanteWithRetry } from "./client";

export interface DanteBridge {
  chat(request: unknown): Promise<DanteChatResponse>;
  getStatus(): BridgeStatus;
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

  async chat(payload: unknown): Promise<DanteChatResponse> {
    const parsedRequest = DanteChatRequestSchema.safeParse(payload);

    if (!parsedRequest.success) {
      throw new ValidationError(parsedRequest.error.format());
    }

    this.setStatus('LOADING');

    // Server-side toggle: local-core uses the real orchestrator
    if (process.env.DANTE_MODE === 'local-core') {
      try {
        const conversationId = parsedRequest.data.conversationId
          || parsedRequest.data.sessionId
          || `local-${Date.now()}`;

        const ctx = parsedRequest.data.context;
        const CORE_URL = process.env.DANTE_CORE_URL || 'http://localhost:3001';
        let previousMessages: { role: 'user' | 'assistant' | 'system'; content: string; timestamp?: string }[] = [];

        try {
          const histRes = await fetch(`${CORE_URL}/api/conversations/${conversationId}/messages`, {
            headers: { 'Authorization': `Bearer ${process.env.DANTE_CORE_TOKEN || ''}` },
            // timeout of 3s for history to not block chat completely
            signal: AbortSignal.timeout(3000)
          });
          const data = await histRes.json();
          if (Array.isArray(data)) {
            previousMessages = data;
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

        return {
          message: {
            role: coreResponse.choices[0].message.role as "assistant" | "user" | "system",
            content: coreResponse.choices[0].message.content,
          },
          status: "success",
          correlationId: coreResponse.conversationId || coreResponse.id,
          usage: coreResponse.usage ? {
            promptTokens: coreResponse.usage.prompt_tokens,
            completionTokens: coreResponse.usage.completion_tokens,
            totalTokens: coreResponse.usage.total_tokens
          } : undefined
        };
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
}

// Singleton para uso directo
export const danteBridge = new DanteBridgeImpl();
