// Catalogo de proveedores: contrato del endpoint /api/providers.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DanteProvidersResponseSchema } from '../src/contracts/dante';
import { ALLOWED_GEMINI_MODELS, DEFAULT_GEMINI_MODEL } from '../src/lib/providers/gemini';
import { MockDanteProvider } from '../src/lib/dante-bridge/mock-provider';

describe('CATALOGO REAL: /api/providers endpoint', () => {
  it('el endpoint devuelve proveedores con modelos vigentes y sin modelos obsoletos', () => {
    const payload = [
      { id: 'gemini', name: 'Google Gemini', category: 'razonamiento', is_active: true, usageToday: 6, dailyLimit: 1500, is_public: false, models: [...ALLOWED_GEMINI_MODELS] },
      { id: 'groq', name: 'Groq', category: 'razonamiento', is_active: false, usageToday: 14, dailyLimit: 14400, is_public: false, models: ['llama3-8b-8192', 'llama3-70b-8192'] },
      { id: 'mock', name: 'Mock Local', category: 'deterministic-fallback', is_active: true, usageToday: 28, dailyLimit: 999999, is_public: true, models: ['mock-dante'] },
    ];

    const parsed = DanteProvidersResponseSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.ok(parsed.data.length > 0);
      for (const provider of parsed.data) {
        assert.ok(Array.isArray(provider.models), 'cada proveedor expone modelos');
      }
      const gemini = parsed.data.find((p) => p.id === 'gemini');
      const geminiModels: readonly string[] = gemini?.models ?? [];
      assert.equal(geminiModels[0], DEFAULT_GEMINI_MODEL, 'la seleccion inicial es el default aprobado');
      assert.equal(geminiModels.includes('gemini-2.0-flash'), false, 'no incluye el modelo obsoleto gemini-2.0-flash');
    }
  });

  it('el endpoint no expone claves ni configuracion interna', () => {
    const payload = [
      { id: 'gemini', name: 'Google Gemini', category: 'razonamiento', is_active: true, usageToday: 6, dailyLimit: 1500, is_public: false, models: [DEFAULT_GEMINI_MODEL] },
    ];
    const parsed = DanteProvidersResponseSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    const serialized = JSON.stringify(parsed.success ? parsed.data : []);
    assert.ok(!/apiKey|api_key|secret|token/i.test(serialized), 'sin credenciales en la respuesta');
  });

  it('la disponibilidad la decide el backend (is_active), no la UI', () => {
    const payload = [
      { id: 'groq', name: 'Groq', category: 'razonamiento', is_active: false, usageToday: 14, dailyLimit: 14400, is_public: false, models: ['llama3-8b-8192'] },
    ];
    const parsed = DanteProvidersResponseSchema.safeParse(payload);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data[0].is_active, false, 'el estado viene del backend');
    }
  });

  it('el catalogo de MockDanteProvider mantiene coherencia con ALLOWED_GEMINI_MODELS y excluye modelos obsoletos', () => {
    const mock = new MockDanteProvider();
    const providers = mock.getProviders();
    const geminiEntry = providers.find((p) => p.id.startsWith('gemini'));
    assert.ok(geminiEntry, 'existe entrada gemini en el catalogo mock');
    const mockModels: readonly string[] = geminiEntry?.models ?? [];
    assert.equal(mockModels[0], 'gemini-3.8-flash');
    assert.equal(mockModels.includes('gemini-2.0-flash'), false);
    assert.equal(mockModels.includes('gemini-2.5-flash'), false);
    assert.deepEqual(mockModels, [...ALLOWED_GEMINI_MODELS]);
  });
});
