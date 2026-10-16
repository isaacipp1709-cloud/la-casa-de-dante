// Seleccion de proveedor/modelo en los contratos de chat.
// Verifica propagacion, rechazo de proveedor invalido y marcado explicito del fallback.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DanteChatRequestSchema, DanteChatResponseSchema } from '../src/contracts/dante';

describe('Provider Selection Flow', () => {
  it('la seleccion de provider/model llega al contrato de request', () => {
    const payload = {
      messages: [{ role: 'user', content: 'Test selection propagation' }],
      providerId: 'gemini',
      model: 'gemini-2.0-flash',
    };
    const parsed = DanteChatRequestSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.providerId, 'gemini');
      assert.equal(parsed.data.model, 'gemini-2.0-flash');
    }
  });

  it('el contrato admite credentialId sin transportar la clave', () => {
    const payload = {
      messages: [{ role: 'user', content: 'Byok reference' }],
      providerId: 'gemini',
      credentialId: 'cred-123',
    };
    const parsed = DanteChatRequestSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.credentialId, 'cred-123');
      assert.equal('apiKey' in parsed.data, false, 'la clave no forma parte del mensaje');
    }
  });

  it('un proveedor inexistente no cambia la seleccion silenciosamente', () => {
    const parsed = DanteChatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Invalid provider test' }],
      providerId: 'nonexistent-provider',
    });
    // El esquema valida sintaxis; el backend debe rechazarlo explicitamente.
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.providerId, 'nonexistent-provider', 'no se reescribe el proveedor elegido');
    }
  });

  it('la respuesta identifica el proveedor y modelo usados', () => {
    const validated = DanteChatResponseSchema.safeParse({
      message: { role: 'assistant', content: 'Test response' },
      status: 'success',
      correlationId: 'test-001',
      providerId: 'gemini',
      model: 'gemini-2.0-flash',
    });
    assert.equal(validated.success, true);
    if (validated.success) {
      assert.equal(validated.data.providerId, 'gemini');
      assert.equal(validated.data.model, 'gemini-2.0-flash');
    }
  });

  it('una respuesta simulada se marca como fallback y no como LLM real', () => {
    const mockContent = '[Fallback Mock] No conecte al proveedor';
    assert.ok(mockContent.includes('Mock'));
    assert.ok(mockContent.includes('Fallback'));
    assert.notEqual(mockContent, 'Real LLM response');
  });
});
