import type { DanteChatRequest, DanteChatResponse } from "@/lib/dante-bridge/types";

export interface LlmGatewayPort {
  complete(request: DanteChatRequest): Promise<DanteChatResponse>;
}
