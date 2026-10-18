import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packVault, unlockVault } from './vault-crypto.mjs';
import { sanitizeVaultPayload, inspectVault, generateEnv, TARGET_ENVIRONMENTS } from './vault-schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_PORT = 4179;
export const DEFAULT_HOST = '127.0.0.1';

/**
 * Servidor HTTP Privado y Local para la Bóveda de Configuración.
 * Restricciones de Seguridad:
 * 1. Vinculado estrictamente a 127.0.0.1 (inaccesible desde red local o internet).
 * 2. Validación de encabezado Host para prevenir ataques de DNS rebinding.
 * 3. Cabeceras estrictas de seguridad (CSP, nosniff, frame-ancestors).
 * 4. Manejo de secretos exclusivamente en memoria RAM efímera (cero persistencia intermedia).
 */
export function createVaultServer(options = {}) {
  const host = options.host || DEFAULT_HOST;
  const port = options.port || DEFAULT_PORT;
  const htmlPath = path.join(__dirname, 'ui', 'index.html');

  // Determinar rutas base de los proyectos
  // __dirname está en <la-casa-de-dante>/tools/config-vault
  const casaRootDir = path.resolve(__dirname, '..', '..');
  const coreRootDir = path.resolve(casaRootDir, '..', 'Dante-AI-Core');

  const server = http.createServer(async (req, res) => {
    // 1. Guardia de Dirección IP: Solo conexiones loopback locales
    const remoteIp = req.socket.remoteAddress;
    if (remoteIp !== '127.0.0.1' && remoteIp !== '::1' && remoteIp !== '::ffff:127.0.0.1') {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Acceso denegado: Este servidor solo acepta conexiones desde 127.0.0.1');
      return;
    }

    // 2. Guardia de DNS Rebinding: Host permitido solo localhost o 127.0.0.1
    const hostHeader = req.headers.host || '';
    if (!hostHeader.startsWith('localhost') && !hostHeader.startsWith('127.0.0.1')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Host no permitido');
      return;
    }

    // Cabeceras de seguridad
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline'; img-src 'self' data:;");

    const url = new URL(req.url, `http://${host}:${port}`);

    // GET / -> Servir interfaz de usuario
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      try {
        const html = fs.readFileSync(htmlPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error al cargar la interfaz de usuario: ' + err.message);
      }
      return;
    }

    // Helper para leer body JSON
    const readJsonBody = async () => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw || raw.trim().length === 0) return {};
      return JSON.parse(raw);
    };

    // POST /api/vault/pack -> Crear bóveda cifrada
    if (req.method === 'POST' && url.pathname === '/api/vault/pack') {
      try {
        const body = await readJsonBody();
        const { values, passphrase } = body;

        if (!passphrase || typeof passphrase !== 'string' || passphrase.length < 8) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'La contraseña de desbloqueo debe tener al menos 8 caracteres.' }));
          return;
        }

        const sanitized = sanitizeVaultPayload({ values });
        const vault = packVault(sanitized, passphrase);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, vault }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Error al empaquetar la bóveda.' }));
      }
      return;
    }

    // POST /api/vault/inspect -> Inspeccionar sin revelar secretos
    if (req.method === 'POST' && url.pathname === '/api/vault/inspect') {
      try {
        const body = await readJsonBody();
        const { vaultContent, passphrase } = body;

        if (!passphrase) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Debes proporcionar la contraseña de desbloqueo.' }));
          return;
        }

        const unlocked = unlockVault(vaultContent, passphrase);
        const inspection = inspectVault(unlocked);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, inspection }));
      } catch (err) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Fallo de autenticación de la bóveda.' }));
      }
      return;
    }

    // POST /api/vault/export-env -> Generar contenido .env.local
    if (req.method === 'POST' && url.pathname === '/api/vault/export-env') {
      try {
        const body = await readJsonBody();
        const { vaultContent, passphrase, targetId } = body;

        const unlocked = unlockVault(vaultContent, passphrase);
        const envContent = generateEnv(unlocked, targetId);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, envContent }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Error al exportar variables.' }));
      }
      return;
    }

    // POST /api/vault/write-env -> Escribir directamente a .env.local de Core o Casa
    if (req.method === 'POST' && url.pathname === '/api/vault/write-env') {
      try {
        const body = await readJsonBody();
        const { vaultContent, passphrase, targetId } = body;

        const target = TARGET_ENVIRONMENTS.find((t) => t.id === targetId);
        if (!target) throw new Error('Entorno objetivo desconocido: ' + targetId);

        const unlocked = unlockVault(vaultContent, passphrase);
        const envContent = generateEnv(unlocked, targetId);

        let targetDir = null;
        if (target.component === 'Casa') targetDir = casaRootDir;
        else if (target.component === 'Core') targetDir = coreRootDir;

        if (!targetDir || !fs.existsSync(targetDir)) {
          throw new Error(`Directorio del componente ${target.component} no encontrado en el sistema.`);
        }

        const targetFilePath = path.join(targetDir, '.env.local');
        fs.writeFileSync(targetFilePath, envContent, { mode: 0o600 }); // Permisos estrictos de lectura solo propietario

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, writtenPath: targetFilePath }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Error al guardar archivo .env.local.' }));
      }
      return;
    }

    // POST /api/vault/shutdown -> Cerrar servidor ordenadamente
    if (req.method === 'POST' && url.pathname === '/api/vault/shutdown') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Servidor cerrándose.' }));
      setTimeout(() => {
        server.close(() => process.exit(0));
      }, 500);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Ruta no encontrada');
  });

  return {
    server,
    start: () =>
      new Promise((resolve, reject) => {
        server.listen(port, host, () => {
          resolve({ host, port, url: `http://${host}:${port}` });
        });
        server.on('error', reject);
      }),
    stop: () =>
      new Promise((resolve) => {
        server.close(resolve);
      }),
  };
}

// Ejecución directa si se invoca con `node server.mjs`
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const port = process.env.VAULT_PORT ? parseInt(process.env.VAULT_PORT, 10) : DEFAULT_PORT;
  const instance = createVaultServer({ port });
  instance.start().then(({ url }) => {
    console.log('================================================================');
    console.log('  Dante Config Vault · Servidor Privado Local Activo');
    console.log(`  URL: ${url}`);
    console.log('  Seguridad: Solo accesible desde esta máquina (127.0.0.1)');
    console.log('  Presiona Ctrl+C o usa el botón de cierre en la interfaz.');
    console.log('================================================================');
  }).catch((err) => {
    console.error('Error al iniciar el servidor:', err);
    process.exit(1);
  });
}
