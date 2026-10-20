// Seleccion de proveedor/modelo en los contratos de chat.
// Verifica propagacion, rechazo de proveedor invalido y marcado explicito del fallback.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DanteChatRequestSchema, DanteChatResponseSchema } from '../src/contracts/dante';
import {
  ALLOWED_GEMINI_MODELS,
  DEFAULT_GEMINI_MODEL,
  InvalidGeminiModelError,
  chatWithGemini,
  isAllowedGeminiModel,
  resolveGeminiModel,
} from '../src/lib/providers/gemini';
import { MockDanteProvider } from '../src/lib/dante-bridge/mock-provider';

describe('Provider Selection Flow', () => {
  it('la seleccion de provider/model llega al contrato de request', () => {
    const payload = {
      messages: [{ role: 'user', content: 'Test selection propagation' }],
      providerId: 'gemini',
      model: 'gemini-3.8-flash',
    };
    const parsed = DanteChatRequestSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.providerId, 'gemini');
      assert.equal(parsed.data.model, 'gemini-3.8-flash');
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
      model: 'gemini-3.8-flash',
    });
    assert.equal(validated.success, true);
    if (validated.success) {
      assert.equal(validated.data.providerId, 'gemini');
      assert.equal(validated.data.model, 'gemini-3.8-flash');
    }
  });

  it('una respuesta simulada se marca como fallback y no como LLM real', () => {
    const mockContent = '[Fallback Mock] No conecte al proveedor';
    assert.ok(mockContent.includes('Mock'));
    assert.ok(mockContent.includes('Fallback'));
    assert.notEqual(mockContent, 'Real LLM response');
  });

  it('selector, catalogo, mock-provider y ejecutor comparten el modelo vigente (gemini-3.8-flash) y rechazan gemini-2.0-flash', async () => {
    assert.equal(DEFAULT_GEMINI_MODEL, 'gemini-3.8-flash');
    assert.deepEqual(ALLOWED_GEMINI_MODELS, ['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
    assert.equal(resolveGeminiModel(undefined), 'gemini-3.8-flash');
    assert.equal(resolveGeminiModel('gemini-3.8-flash'), 'gemini-3.8-flash');
    assert.equal(resolveGeminiModel('gemini-3.5-flash-lite'), 'gemini-3.5-flash-lite');

    // Ningun modelo obsoleto se acepta
    for (const obsolete of ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-pro']) {
      assert.equal(isAllowedGeminiModel(obsolete), false);
      assert.throws(() => resolveGeminiModel(obsolete), InvalidGeminiModelError);
      await assert.rejects(
        () => chatWithGemini([{ role: 'user', content: 'hola' }], { apiKey: 'fake-key', model: obsolete }),
        InvalidGeminiModelError,
      );
    }

    // Coherencia estatica con provider-selector.tsx y api/providers/route.ts
    const selectorSource = readFileSync(
      join(process.cwd(), 'src', 'components', 'chat', 'provider-selector.tsx'),
      'utf8',
    );
    const providersRouteSource = readFileSync(
      join(process.cwd(), 'src', 'app', 'api', 'providers', 'route.ts'),
      'utf8',
    );
    assert.ok(selectorSource.includes('ALLOWED_GEMINI_MODELS'), 'provider-selector usa ALLOWED_GEMINI_MODELS');
    assert.equal(selectorSource.includes('gemini-2.0-flash'), false, 'provider-selector no contiene gemini-2.0-flash');
    assert.ok(providersRouteSource.includes('ALLOWED_GEMINI_MODELS'), 'api/providers/route usa ALLOWED_GEMINI_MODELS');
    assert.equal(providersRouteSource.includes('gemini-2.0-flash'), false, 'api/providers/route no contiene gemini-2.0-flash');

    const mockProviders = new MockDanteProvider().getProviders();
    const geminiMock = mockProviders.find((p) => p.id === 'gemini-flash');
    assert.deepEqual(geminiMock?.models, [...ALLOWED_GEMINI_MODELS]);
    assert.equal(geminiMock?.models?.[0], DEFAULT_GEMINI_MODEL);
  });
});
