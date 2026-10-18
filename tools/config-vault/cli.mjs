#!/usr/bin/env node

/**
 * Dante Config Vault · Interfaz de Línea de Comandos (CLI)
 *
 * Comandos:
 *   node cli.mjs serve [--port 4179]
 *   node cli.mjs pack --input <file.json> --output <file.dantevault>
 *   node cli.mjs inspect --vault <file.dantevault>
 *   node cli.mjs export --vault <file.dantevault> --target <core-dev|casa-dev|core-prod|casa-prod>
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { packVault, unlockVault } from './vault-crypto.mjs';
import { sanitizeVaultPayload, inspectVault, generateEnv } from './vault-schema.mjs';
import { createVaultServer, DEFAULT_PORT } from './server.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function printHelp() {
  console.log(`
Uso de Dante Config Vault CLI:

  node cli.mjs serve [--port <puerto>]
    Inicia el servidor web privado local (127.0.0.1) con el formulario interactivo.

  node cli.mjs pack --input <archivo.json> --output <archivo.dantevault>
    Cifra un archivo JSON de configuración con scrypt y AES-256-GCM.

  node cli.mjs inspect --vault <archivo.dantevault>
    Desbloquea la bóveda y muestra la auditoría de preparación sin revelar secretos.

  node cli.mjs export --vault <archivo.dantevault> --target <id-entorno> [--output <archivo>]
    Exporta el contenido .env.local para el entorno elegido.
    Entornos válidos: core-development, core-production, casa-development, casa-production.
`);
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function parseArgs(args) {
  const result = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        result[key] = next;
        i++;
      } else {
        result[key] = true;
      }
    } else {
      result._.push(arg);
    }
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  if (!command || command === 'help' || args.help) {
    printHelp();
    process.exit(0);
  }

  // 1. SERVE
  if (command === 'serve') {
    const port = args.port ? parseInt(args.port, 10) : DEFAULT_PORT;
    const instance = createVaultServer({ port });
    const { url } = await instance.start();
    console.log(`\n================================================================`);
    console.log(`  Dante Config Vault · Formulario Privado Activo`);
    console.log(`  Abre en tu navegador: ${url}`);
    console.log(`  Seguridad: Restringido a loopback local (127.0.0.1).`);
    console.log(`================================================================\n`);
    return;
  }

  // 2. PACK
  if (command === 'pack') {
    const inputPath = args.input;
    const outputPath = args.output;

    if (!inputPath || !outputPath) {
      console.error('Error: Debes especificar --input <archivo.json> y --output <archivo.dantevault>');
      process.exit(1);
    }

    if (!fs.existsSync(inputPath)) {
      console.error(`Error: Archivo de entrada no encontrado: ${inputPath}`);
      process.exit(1);
    }

    const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const passphrase = args.passphrase || await promptHidden('Introduce la contraseña para cifrar la bóveda: ');

    if (!passphrase || passphrase.length < 8) {
      console.error('Error: La contraseña debe tener al menos 8 caracteres.');
      process.exit(1);
    }

    const sanitized = sanitizeVaultPayload(raw);
    const vault = packVault(sanitized, passphrase);

    fs.writeFileSync(outputPath, JSON.stringify(vault, null, 2), 'utf8');
    console.log(`✓ Bóveda cifrada guardada exitosamente en: ${outputPath}`);
    process.exit(0);
  }

  // 3. INSPECT
  if (command === 'inspect') {
    const vaultPath = args.vault;
    if (!vaultPath || !fs.existsSync(vaultPath)) {
      console.error('Error: Debes especificar un archivo existente con --vault <archivo.dantevault>');
      process.exit(1);
    }

    const vaultContent = fs.readFileSync(vaultPath, 'utf8');
    const passphrase = args.passphrase || await promptHidden('Contraseña de desbloqueo: ');

    try {
      const unlocked = unlockVault(vaultContent, passphrase);
      const inspection = inspectVault(unlocked);

      console.log(`\n=== AUDITORÍA DE PREPARACIÓN DE LA BÓVEDA ===`);
      console.log(`Variables configuradas: ${inspection.counts.configured}/${inspection.counts.total}`);
      console.log(`Variables pendientes:   ${inspection.counts.pending}/${inspection.counts.total}\n`);

      console.log(`--- Estado por Entorno Objetivo ---`);
      for (const env of inspection.environments) {
        const status = env.ready ? '✓ LISTO' : `FALTAN ${env.missingRequired.length} VARIABLES REQUERIDAS`;
        console.log(`• ${env.name.padEnd(45)}: [${status}]`);
        if (!env.ready) {
          console.log(`  Requeridas ausentes: ${env.missingRequired.map((m) => m.key).join(', ')}`);
        }
      }

      console.log(`\n--- Detalle de Variables (Sin revelar secretos) ---`);
      for (const f of inspection.fields) {
        const mark = f.isConfigured ? '✓' : ' ';
        console.log(`[${mark}] ${f.key.padEnd(30)} | ${f.hint}`);
      }
      console.log('');
      process.exit(0);
    } catch (err) {
      console.error(`\nError al desbloquear: ${err.message}\n`);
      process.exit(1);
    }
  }

  // 4. EXPORT
  if (command === 'export') {
    const vaultPath = args.vault;
    const targetId = args.target;
    if (!vaultPath || !targetId) {
      console.error('Error: Debes especificar --vault <archivo.dantevault> y --target <core-dev|casa-dev|core-prod|casa-prod>');
      process.exit(1);
    }

    const vaultContent = fs.readFileSync(vaultPath, 'utf8');
    const passphrase = args.passphrase || await promptHidden('Contraseña de desbloqueo: ');

    try {
      const unlocked = unlockVault(vaultContent, passphrase);
      const envContent = generateEnv(unlocked, targetId);

      if (args.output) {
        fs.writeFileSync(args.output, envContent, { mode: 0o600 });
        console.log(`✓ Archivo de entorno escrito en: ${args.output}`);
      } else {
        console.log('\n' + envContent);
      }
      process.exit(0);
    } catch (err) {
      console.error(`\nError al exportar: ${err.message}\n`);
      process.exit(1);
    }
  }

  console.error(`Comando desconocido: ${command}`);
  printHelp();
  process.exit(1);
}

main().catch((err) => {
  console.error('Fallo de ejecución:', err);
  process.exit(1);
});
