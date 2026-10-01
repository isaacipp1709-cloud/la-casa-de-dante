import { DanteChatResponse } from "./types";
import { DanteChatRequestSchema } from "@/contracts/dante";
import { MockDanteProvider } from "./mock-provider";
import { ValidationError } from "./errors";

export interface DanteBridge {
  chat(request: unknown): Promise<DanteChatResponse>;
}

export class DanteBridgeImpl implements DanteBridge {
  private provider: MockDanteProvider;

  constructor() {
    this.provider = new MockDanteProvider();
  }

  async chat(payload: unknown): Promise<DanteChatResponse> {
    const parsedRequest = DanteChatRequestSchema.safeParse(payload);

    if (!parsedRequest.success) {
      throw new ValidationError(parsedRequest.error.format());
    }

    // In a real implementation, we would inject the provider.
    // For now, we use the mock provider to keep $0 cost.
    const response = await this.provider.processChat(parsedRequest.data);

    return response;
  }
}

// Exportamos una instancia única para uso directo
export const danteBridge = new DanteBridgeImpl();
