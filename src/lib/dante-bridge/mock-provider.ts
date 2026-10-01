import { DanteChatRequest, DanteChatResponse } from "./types";
import { DanteChatResponseSchema } from "@/contracts/dante";

export class MockDanteProvider {
  async processChat(request: DanteChatRequest): Promise<DanteChatResponse> {
    const sessionId = request.sessionId ?? "local-session";
    const correlationId = `${sessionId}-${request.messages.length}`;

    const response: DanteChatResponse = {
      message: {
        role: "assistant",
        content: "Esta es una respuesta simulada de Dante-AI-Core. Operando en modo offline y $0 cost.",
        timestamp: new Date().toISOString(),
      },
      status: "success",
      correlationId: correlationId,
      usage: {
        promptTokens: 10,
        completionTokens: 25,
        totalTokens: 35,
      },
    };

    // Validar determinísticamente la respuesta antes de enviarla
    const result = DanteChatResponseSchema.safeParse(response);
    if (!result.success) {
      throw new Error("El mock provider generó una respuesta inválida");
    }

    return result.data;
  }
}
