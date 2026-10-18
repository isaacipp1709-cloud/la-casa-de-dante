import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packVault, unlockVault, VAULT_FORMAT, VAULT_VERSION } from '../vault-crypto.mjs';
import { sanitizeVaultPayload, inspectVault, generateEnv } from '../vault-schema.mjs';
import { createVaultServer } from '../server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Datos estrictamente ficticios para pruebas (NUNCA usar secretos reales)
const FAKE_CONFIG = {
  DANTE_CORE_TOKEN: 'fake-token-dante-core-32-chars-long-12345',
  CREDENTIAL_MASTER_SECRET: 'fake-master-secret-for-testing-only-67890',
  DATABASE_URL: 'postgresql://fake_user:fake_password@ep-fake.us-east-2.neon.tech/neondb?sslmode=require',
  USE_DATABASE: 'true',
  DANTE_CORE_URL: 'http://localhost:3001',
  DANTE_MODE: 'local-core',
  NEXT_PUBLIC_SUPABASE_URL: 'https://fake-supabase-project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-anon-key-payload.fake-signature',
  DANTE_AUTHORIZED_OWNER_IDS: '11111111-2222-3333-4444-555555555555',
  DANTE_ADMIN_OWNER_IDS: '11111111-2222-3333-4444-555555555555',
  GOOGLE_AI_API_KEY: 'AIzaSyFakeKeyForTestingPurposesOnly1234',
  DEFAULT_GEMINI_MODEL: 'gemini-2.0-flash',
  GROQ_API_KEY: 'gsk_fakeGroqKeyForTesting5678',
  OLLAMA_BASE_URL: 'http://localhost:11434',
};

const TEST_PASSPHRASE = 'MiClaveSeguraDePrueba2026!';

describe('Dante Config Vault · Pruebas Criptográficas y de Seguridad', () => {
  it('1. Cifra y empaqueta en memoria: ningún secreto aparece en texto plano en la bóveda', () => {
    const sanitized = sanitizeVaultPayload({ values: FAKE_CONFIG });
    const vault = packVault(sanitized, TEST_PASSPHRASE);

    assert.equal(vault.format, VAULT_FORMAT);
    assert.equal(vault.version, VAULT_VERSION);
    assert.equal(vault.kdf.algorithm, 'scrypt');
    assert.equal(vault.cipher.algorithm, 'aes-256-gcm');
    assert.ok(typeof vault.ciphertext === 'string' && vault.ciphertext.length > 50);

    const serialized = JSON.stringify(vault);
    // Verificar que NINGUNO de los secretos ficticios aparezca en el archivo
    assert.ok(!serialized.includes(FAKE_CONFIG.DANTE_CORE_TOKEN), 'DANTE_CORE_TOKEN no aparece en plano');
    assert.ok(!serialized.includes(FAKE_CONFIG.CREDENTIAL_MASTER_SECRET), 'CREDENTIAL_MASTER_SECRET no aparece en plano');
    assert.ok(!serialized.includes('fake_password'), 'Password de base de datos no aparece en plano');
    assert.ok(!serialized.includes(FAKE_CONFIG.GOOGLE_AI_API_KEY), 'GOOGLE_AI_API_KEY no aparece en plano');
    assert.ok(!serialized.includes(TEST_PASSPHRASE), 'La contraseña de desbloqueo nunca se incluye en el archivo');
  });

  it('2. Recuperación exacta con la contraseña correcta', () => {
    const sanitized = sanitizeVaultPayload({ values: FAKE_CONFIG });
    const vault = packVault(sanitized, TEST_PASSPHRASE);

    const unlocked = unlockVault(vault, TEST_PASSPHRASE);
    assert.ok(unlocked && typeof unlocked === 'object');
    assert.equal(unlocked.values.DANTE_CORE_TOKEN, FAKE_CONFIG.DANTE_CORE_TOKEN);
    assert.equal(unlocked.values.DATABASE_URL, FAKE_CONFIG.DATABASE_URL);
    assert.equal(unlocked.values.GOOGLE_AI_API_KEY, FAKE_CONFIG.GOOGLE_AI_API_KEY);
    assert.equal(unlocked.values.DEFAULT_GEMINI_MODEL, 'gemini-2.0-flash');
  });

  it('3. Rechaza contraseña incorrecta con error de autenticación criptográfica', () => {
    const sanitized = sanitizeVaultPayload({ values: FAKE_CONFIG });
    const vault = packVault(sanitized, TEST_PASSPHRASE);

    assert.throws(
      () => unlockVault(vault, 'ContrasenaCompletamenteErronea!'),
      /VAULT_AUTH_FAILED/,
      'Debe fallar la autenticación de la clave'
    );
  });

  it('4. Rechaza archivo alterado (integridad autenticada AEAD de AES-256-GCM)', () => {
    const sanitized = sanitizeVaultPayload({ values: FAKE_CONFIG });
    const vault = packVault(sanitized, TEST_PASSPHRASE);

    // Caso A: Modificar un carácter del ciphertext
    const tamperedCiphertext = {
      ...vault,
      ciphertext: vault.ciphertext.slice(0, 10) + (vault.ciphertext[10] === 'A' ? 'B' : 'A') + vault.ciphertext.slice(11),
    };
    assert.throws(
      () => unlockVault(tamperedCiphertext, TEST_PASSPHRASE),
      /VAULT_AUTH_FAILED/,
      'Debe detectar alteración en el ciphertext'
    );

    // Caso B: Modificar el authTag
    const tamperedTag = {
      ...vault,
      cipher: {
        ...vault.cipher,
        authTag: Buffer.alloc(16, 0xaa).toString('base64'),
      },
    };
    assert.throws(
      () => unlockVault(tamperedTag, TEST_PASSPHRASE),
      /VAULT_AUTH_FAILED/,
      'Debe detectar authTag falso o modificado'
    );

    // Caso C: Modificar el IV
    const tamperedIv = {
      ...vault,
      cipher: {
        ...vault.cipher,
        iv: Buffer.alloc(16, 0xff).toString('base64'),
      },
    };
    assert.throws(
      () => unlockVault(tamperedIv, TEST_PASSPHRASE),
      /VAULT_AUTH_FAILED/,
      'Debe detectar IV modificado'
    );
  });

  it('5. Rechaza formato o versiones manipuladas', () => {
    const sanitized = sanitizeVaultPayload({ values: FAKE_CONFIG });
    const vault = packVault(sanitized, TEST_PASSPHRASE);

    const invalidVersion = { ...vault, version: 999 };
    assert.throws(() => unlockVault(invalidVersion, TEST_PASSPHRASE), /VAULT_UNSUPPORTED_VERSION/);

    const invalidFormat = { ...vault, format: 'unknown-format' };
    assert.throws(() => unlockVault(invalidFormat, TEST_PASSPHRASE), /VAULT_UNSUPPORTED_VERSION/);
  });

  it('6. Sanitización protege contra inyección de prototipo y código no deseado', () => {
    const maliciousPayload = {
      values: {
        DANTE_CORE_TOKEN: 'token-seguro-1234567890',
        __proto__: { isAdmin: true },
        evilScript: '<script>alert(1)</script>',
      },
    };

    const sanitized = sanitizeVaultPayload(maliciousPayload);
    assert.equal(sanitized.values.DANTE_CORE_TOKEN, 'token-seguro-1234567890');
    // Campos no definidos en el esquema se descartan
    assert.equal(sanitized.values.evilScript, undefined);
    assert.equal(sanitized.values.__proto__, Object.prototype);
  });

  it('7. Auditoría de inspección: comprueba variables requeridas sin exponer secretos', () => {
    // Caso con variables parciales (faltan algunas para probar reporte)
    const partialConfig = {
      DANTE_CORE_TOKEN: 'token-valido-12345678901234567890',
      CREDENTIAL_MASTER_SECRET: 'master-secret-12345678901234567890',
      DANTE_ADMIN_OWNER_IDS: '11111111-2222-3333-4444-555555555555',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      GOOGLE_AI_API_KEY: 'AIzaSySecretApiKey123456',
    };

    const sanitized = sanitizeVaultPayload({ values: partialConfig });
    const vault = packVault(sanitized, TEST_PASSPHRASE);
    const unlocked = unlockVault(vault, TEST_PASSPHRASE);
    const inspection = inspectVault(unlocked);

    assert.equal(inspection.counts.configured, 6);
    assert.ok(inspection.counts.pending > 0);

    // Ningún campo de la inspección contiene el secreto en texto plano
    const serializedInspection = JSON.stringify(inspection);
    assert.ok(!serializedInspection.includes('AIzaSySecretApiKey123456'), 'La clave no se expone en la inspección');

    // Muestra pistas enmascaradas para campos sensibles configurados
    const googleField = inspection.fields.find((f) => f.key === 'GOOGLE_AI_API_KEY');
    assert.ok(googleField.isConfigured);
    assert.ok(googleField.hint.includes('••••••••'));

    // Entornos objetivos evalúan correctamente faltantes
    const coreDev = inspection.environments.find((e) => e.id === 'core-development');
    assert.ok(coreDev);
    // Tiene DANTE_CORE_TOKEN, CREDENTIAL_MASTER_SECRET, DANTE_ADMIN_OWNER_IDS, GOOGLE_AI_API_KEY
    assert.equal(coreDev.ready, true);

    const casaProd = inspection.environments.find((e) => e.id === 'casa-production');
    assert.ok(casaProd);
    // Falta DANTE_AUTHORIZED_OWNER_IDS en partialConfig
    assert.equal(casaProd.ready, false);
    assert.ok(casaProd.missingRequired.some((m) => m.key === 'DANTE_AUTHORIZED_OWNER_IDS'));
  });

  it('8. Generación de entorno .env.local para Core y Casa', () => {
    const sanitized = sanitizeVaultPayload({ values: FAKE_CONFIG });
    const unlocked = sanitizeVaultPayload({ values: FAKE_CONFIG });

    // Core development
    const coreEnv = generateEnv(unlocked, 'core-development');
    assert.ok(coreEnv.includes('DANTE_CORE_TOKEN="fake-token-dante-core-32-chars-long-12345"'));
    assert.ok(coreEnv.includes('DEFAULT_GEMINI_MODEL="gemini-2.0-flash"'));

    // Casa development
    const casaEnv = generateEnv(unlocked, 'casa-development');
    assert.ok(casaEnv.includes('NEXT_PUBLIC_SUPABASE_URL="https://fake-supabase-project.supabase.co"'));
    assert.ok(casaEnv.includes('DANTE_MODE="local-core"'));
    assert.ok(casaEnv.includes('DANTE_AUTHORIZED_OWNER_IDS="11111111-2222-3333-4444-555555555555"'));
  });

  it('9. Servidor local seguro: rechaza accesos ajenos a 127.0.0.1 y maneja pack/inspect', async () => {
    const testPort = 4188;
    const serverInstance = createVaultServer({ port: testPort });
    const { url } = await serverInstance.start();

    try {
      // Test GET /
      const getRes = await fetch(`${url}/`);
      assert.equal(getRes.status, 200);
      const html = await getRes.text();
      assert.ok(html.includes('Bóveda de Configuración Portátil'));

      // Test DNS Rebinding prevention (Host malicioso via http.request directo)
      const rebindingStatus = await new Promise((resolve) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: testPort,
            path: '/',
            method: 'GET',
            headers: { Host: 'attacker.example.com' },
          },
          (res) => resolve(res.statusCode)
        );
        req.end();
      });
      assert.equal(rebindingStatus, 403, 'Host no permitido debe ser rechazado con 403');

      // Test POST /api/vault/pack
      const packRes = await fetch(`${url}/api/vault/pack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          values: FAKE_CONFIG,
          passphrase: TEST_PASSPHRASE,
        }),
      });
      assert.equal(packRes.status, 200);
      const packData = await packRes.json();
      assert.equal(packData.ok, true);
      assert.equal(packData.vault.format, VAULT_FORMAT);

      // Test POST /api/vault/inspect con clave correcta
      const inspectRes = await fetch(`${url}/api/vault/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultContent: JSON.stringify(packData.vault),
          passphrase: TEST_PASSPHRASE,
        }),
      });
      assert.equal(inspectRes.status, 200);
      const inspectData = await inspectRes.json();
      assert.equal(inspectData.ok, true);
      assert.ok(inspectData.inspection.counts.configured > 10);

      // Test POST /api/vault/inspect con clave errónea
      const inspectFailRes = await fetch(`${url}/api/vault/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultContent: JSON.stringify(packData.vault),
          passphrase: 'clave-falsa-invalida',
        }),
      });
      assert.equal(inspectFailRes.status, 401);
    } finally {
      await serverInstance.stop();
    }
  });

  it('10. Blindaje de Git: los archivos de bóveda no son rastreados por repositorios de código', () => {
    // Buscar .gitignore en repositorios de código
    const candidatePaths = [
      path.resolve(__dirname, '..', '..', '.gitignore'),
      path.resolve(__dirname, '..', '..', '..', '.gitignore'),
      path.resolve(__dirname, '..', '..', '..', 'Dante-AI-Core', '.gitignore'),
      path.resolve(__dirname, '..', '..', '..', 'la-casa-de-dante', '.gitignore'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        if (!p.toLowerCase().includes('private-config')) {
          assert.ok(content.includes('*.dantevault'), `${p} debe ignorar *.dantevault`);
          assert.ok(content.includes('vault-output/'), `${p} debe ignorar vault-output/`);
        }
      }
    }
    assert.ok(true);
  });

  it('11. Comprobaciones de solo lectura en memoria: cero fugas de secretos y análisis estático', async () => {
    const { analyzeProvidersCatalog, executeAllReadOnlyChecks } = await import('../read-checks.mjs');

    const catalog = analyzeProvidersCatalog(FAKE_CONFIG);
    assert.equal(catalog.length, 6);
    const gemini = catalog.find((c) => c.providerId === 'gemini');
    assert.equal(gemini.status, 'CLAVE_CONFIGURADA (Inferencia no probada / sin coste)');
    assert.equal(gemini.keyConfigured, true);
    assert.equal(gemini.keyState, 'PRESENTE');

    const openrouter = catalog.find((c) => c.providerId === 'openrouter');
    assert.ok(openrouter.status.includes('PENDIENTE_DESARROLLO'));

    // Ejecución con FAKE_CONFIG (falla conexión remota a host ficticio pero sanitiza sin filtrar secretos)
    const checks = await executeAllReadOnlyChecks(FAKE_CONFIG);
    assert.ok(checks.timestamp);
    assert.ok(checks.neon);
    assert.ok(checks.supabase);
    assert.ok(checks.services);
    assert.ok(checks.providers);

    // Verificar que NINGÚN secreto ficticio se filtre en los errores sanitizados
    const rawJson = JSON.stringify(checks);
    assert.ok(!rawJson.includes('fake_password'), 'No debe filtrar contraseña de base de datos');
    assert.ok(!rawJson.includes(FAKE_CONFIG.NEXT_PUBLIC_SUPABASE_ANON_KEY), 'No debe filtrar anon key');
    assert.ok(!rawJson.includes(FAKE_CONFIG.GOOGLE_AI_API_KEY), 'No debe filtrar clave de Google');
  });

  it('12. Endpoint /api/vault/run-read-checks ejecuta y valida contraseña en memoria', async () => {
    const testPort = 4189;
    const serverInstance = createVaultServer({ port: testPort });
    const { url } = await serverInstance.start();

    try {
      const sanitized = sanitizeVaultPayload({ values: FAKE_CONFIG });
      const vault = packVault(sanitized, TEST_PASSPHRASE);
      const vaultContent = JSON.stringify(vault);

      // Prueba con contraseña errónea -> 401
      const failRes = await fetch(`${url}/api/vault/run-read-checks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultContent, passphrase: 'clave-incorrecta' }),
      });
      assert.equal(failRes.status, 401);

      // Prueba con contraseña correcta -> 200 con checks
      const okRes = await fetch(`${url}/api/vault/run-read-checks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultContent, passphrase: TEST_PASSPHRASE }),
      });
      assert.equal(okRes.status, 200);
      const okData = await okRes.json();
      assert.equal(okData.ok, true);
      assert.ok(okData.checks);
      assert.ok(Array.isArray(okData.checks.providers));
    } finally {
      await serverInstance.stop();
    }
  });
});
