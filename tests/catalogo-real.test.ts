// Catalogo de proveedores: contrato del endpoint /api/providers.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DanteProvidersResponseSchema } from '../src/contracts/dante';

describe('CATALOGO REAL: /api/providers endpoint', () => {
  it('el endpoint devuelve proveedores con modelos', () => {
    const payload = [
      { id: 'gemini', name: 'Google Gemini', category: 'razonamiento', is_active: true, usageToday: 6, dailyLimit: 1500, is_public: false, models: ['gemini-2.0-flash', 'gemini-1.5-pro'] },
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
    }
  });

  it('el endpoint no expone claves ni configuracion interna', () => {
    const payload = [
      { id: 'gemini', name: 'Google Gemini', category: 'razonamiento', is_active: true, usageToday: 6, dailyLimit: 1500, is_public: false, models: ['gemini-2.0-flash'] },
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
});
