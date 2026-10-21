import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  chatWithDante,
  chatWithDanteWithRetry,
  normalizeCoreUrl,
  buildCoreEndpointUrl,
  getDanteCoreUrl,
} from '../client';
import { DanteBridgeImpl } from '../index';

describe('Dante Bridge Resilience', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  // Test 1: Timeout (>30s) -> lanza error 'TIMEOUT'
  it('Timeout (>30s) lanza error TIMEOUT', async () => {
    mock.method(global, 'fetch', () => 
      new Promise((_, reject) => {
        const error = new Error('AbortError');
        error.name = 'AbortError';
        setTimeout(() => reject(error), 10);
      })
    );

    await assert.rejects(
      chatWithDante([{ role: 'user', content: 'hola' }], {}, 5),
      (err: Error) => err.message === 'TIMEOUT'
    );
  });

  // Test 2: Core responde 500 -> lanza error 'CORE_ERROR'
  it('Core responde 500 lanza error CORE_ERROR', async () => {
    mock.method(global, 'fetch', async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'INTERNAL_SERVER_ERROR' }),
      text: async () => 'Error',
    }));

    await assert.rejects(
      chatWithDante([{ role: 'user', content: 'hola' }]),
      (err: Error) => err.message === 'INTERNAL_SERVER_ERROR'
    );
  });

  // Test 3: Reintento: falla 1ra, éxito 2da -> retorna respuesta
  it('Reintento: falla 1ra, exito 2da retorna respuesta', async () => {
    let callCount = 0;
    mock.method(global, 'fetch', async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: 'ERROR_1' }),
        };
      }
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { role: 'assistant', content: 'hola' } }] }),
      };
    });

    const res = await chatWithDanteWithRetry([{ role: 'user', content: 'hola' }]);
    assert.strictEqual(res.choices[0].message.content, 'hola');
    assert.strictEqual(callCount, 2);
  });

  // Test 4: Estados: setStatus/getStatus funciona correctamente
  it('Estados: getStatus funciona correctamente y se actualiza', async () => {
    process.env.DANTE_MODE = 'local-core';
    process.env.DANTE_CORE_TOKEN = 'bridge-token-de-prueba-suficientemente-largo';
    mock.method(global, 'fetch', async () => ({
      ok: true,
      json: async () => ({
        id: 'test',
        choices: [{ message: { role: 'assistant', content: 'test' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      }),
    }));

    const bridge = new DanteBridgeImpl();
    assert.strictEqual(bridge.getStatus().state, 'LOADING');

    await bridge.chat({
      messages: [{ role: 'user', content: 'hola' }],
    }, { verifiedOwnerId: 'user-test' });

    assert.strictEqual(bridge.getStatus().state, 'CONNECTED');
    delete process.env.DANTE_MODE;
  });

  // Test 5: Intercepta [Fallback Mock] de Dante-AI-Core y sintetiza respuesta limpia sin filtrar [System Context]
  it('Intercepta [Fallback Mock] del Core y entrega síntesis cognitiva limpia', async () => {
    process.env.DANTE_MODE = 'local-core';
    process.env.DANTE_CORE_TOKEN = 'bridge-token-de-prueba-suficientemente-largo';
    mock.method(global, 'fetch', async () => ({
      ok: true,
      json: async () => ({
        id: 'req-fallback-1',
        model: 'mock',
        choices: [
          {
            message: {
              role: 'assistant',
              content:
                '[Fallback Mock] No pude conectarme a mis proveedores ahora, pero estoy aquí. ¿En qué más puedo ayudarte? (Tu mensaje: "hola , qué tal , qué puedes hacer?\\n[System Context: Financial calculations: {}]")',
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
    }));

    const bridge = new DanteBridgeImpl();
    const res = await bridge.chat({
      messages: [{ role: 'user', content: 'hola , qué tal , qué puedes hacer?' }],
    }, { verifiedOwnerId: 'user-test' });

    assert.strictEqual(res.status, 'success');
    assert.ok(!res.message.content.includes('[Fallback Mock]'));
    assert.ok(!res.message.content.includes('[System Context:'));
    assert.ok(res.message.content.includes('37 neuronas'));
    delete process.env.DANTE_MODE;
  });
  describe('URL Normalization', () => {
    it('normalizeCoreUrl recorta espacios y remueve barras finales', () => {
      assert.strictEqual(
        normalizeCoreUrl('  https://dante-ai-core.vercel.app/  '),
        'https://dante-ai-core.vercel.app'
      );
      assert.strictEqual(
        normalizeCoreUrl('https://dante-ai-core.vercel.app///'),
        'https://dante-ai-core.vercel.app'
      );
      assert.strictEqual(
        normalizeCoreUrl('https://dante-ai-core.vercel.app'),
        'https://dante-ai-core.vercel.app'
      );
    });

    it('normalizeCoreUrl usa fallback cuando la entrada es nula o vacia', () => {
      assert.strictEqual(normalizeCoreUrl(''), 'http://localhost:3001');
      assert.strictEqual(normalizeCoreUrl('   '), 'http://localhost:3001');
      assert.strictEqual(normalizeCoreUrl(null), 'http://localhost:3001');
      assert.strictEqual(normalizeCoreUrl(undefined), 'http://localhost:3001');
    });

    it('buildCoreEndpointUrl evita dobles barras diagonales', () => {
      assert.strictEqual(
        buildCoreEndpointUrl('/api/chat', 'https://dante-ai-core.vercel.app/'),
        'https://dante-ai-core.vercel.app/api/chat'
      );
      assert.strictEqual(
        buildCoreEndpointUrl('api/chat', 'https://dante-ai-core.vercel.app/'),
        'https://dante-ai-core.vercel.app/api/chat'
      );
      assert.strictEqual(
        buildCoreEndpointUrl('/api/health', 'https://dante-ai-core.vercel.app'),
        'https://dante-ai-core.vercel.app/api/health'
      );
    });

    it('chatWithDante despacha fetch a la URL normalizada aun con espacios y barra final en env', async () => {
      const prevEnv = process.env.DANTE_CORE_URL;
      process.env.DANTE_CORE_URL = '  https://dante-preview.vercel.app/  ';

      let requestedUrl = '';
      mock.method(global, 'fetch', async (url: string | URL) => {
        requestedUrl = String(url);
        return {
          ok: true,
          json: async () => ({
            id: 'norm-1',
            choices: [{ message: { role: 'assistant', content: 'normalizado' } }],
          }),
        };
      });

      try {
        await chatWithDante([{ role: 'user', content: 'test' }]);
        assert.strictEqual(requestedUrl, 'https://dante-preview.vercel.app/api/chat');
      } finally {
        if (prevEnv !== undefined) {
          process.env.DANTE_CORE_URL = prevEnv;
        } else {
          delete process.env.DANTE_CORE_URL;
        }
      }
    });
  });
});
