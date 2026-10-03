import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { chatWithDante, chatWithDanteWithRetry } from '../client';
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
    });

    assert.strictEqual(bridge.getStatus().state, 'CONNECTED');
    delete process.env.DANTE_MODE;
  });
});
