import { ownerAssertionHeaders } from '../credentials/owner-assertion';

/**
 * Cabeceras del chat hacia Dante-AI-Core.
 * La identidad va SIEMPRE en la asercion HMAC del servidor; nunca se envia
 * X-User-ID ni cualquier identidad derivada del navegador.
 */

export class OwnerIdentityRequiredError extends Error {
  constructor() {
    super('Owner identity is required');
    this.name = 'OwnerIdentityRequiredError';
  }
}

export interface CoreChatHeaderInput {
  verifiedOwnerId: string;
  conversationId: string;
  timezone?: string;
  locale?: string;
}

export function buildCoreChatHeaders(input: CoreChatHeaderInput): Record<string, string> {
  const assertion = ownerAssertionHeaders(input.verifiedOwnerId);
  if (Object.keys(assertion).length === 0) {
    // Sin secreto de firma no hay identidad verificable: se rechaza, no se degrada.
    throw new OwnerIdentityRequiredError();
  }

  return {
    ...assertion,
    'X-User-Timezone': input.timezone || 'America/Santiago',
    'X-User-Locale': input.locale || 'es-CL',
    'X-Conversation-ID': input.conversationId,
  };
}
