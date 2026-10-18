import crypto from 'node:crypto';

/**
 * Bóveda de Configuración Portátil de Dante - Módulo Criptográfico
 *
 * Estándar:
 * - Algoritmo: AES-256-GCM (Cifrado autenticado con datos asociados - AEAD)
 * - Derivación de clave (KDF): scrypt con parámetros de memoria reforzados (N=32768, r=8, p=1)
 * - Sal: 32 bytes criptográficamente seguros por cada archivo
 * - Vector de inicialización (IV): 16 bytes criptográficamente seguros por cada archivo
 * - Tag de autenticación: 16 bytes (GCM Auth Tag)
 * - AAD: Cabecera fija para vincular formato y versión al texto cifrado
 *
 * Garantía:
 * - Cero almacenamiento de contraseñas.
 * - Cero escritura de secretos en texto plano en disco.
 * - Detección inmediata de cualquier alteración en el archivo o contraseña incorrecta.
 */

export const VAULT_FORMAT = 'dante-config-vault';
export const VAULT_VERSION = 1;
export const VAULT_AAD = 'dante-config-vault:v1';

export const KDF_PARAMS = {
  algorithm: 'scrypt',
  keylen: 32, // 256 bits
  cost: 32768, // N: CPU/memory cost parameter
  blockSize: 8, // r: block size parameter
  parallelization: 1, // p: parallelization parameter
  maxmem: 64 * 1024 * 1024, // 64 MB
};

/**
 * Deriva una clave de 256 bits a partir de la frase de paso y la sal usando scrypt.
 * @param {string} passphrase
 * @param {Buffer} salt
 * @returns {Buffer}
 */
export function deriveKey(passphrase, salt) {
  if (typeof passphrase !== 'string' || passphrase.trim().length === 0) {
    throw new Error('VAULT_INVALID_PASSPHRASE: La contraseña de desbloqueo no puede estar vacía.');
  }
  return crypto.scryptSync(passphrase, salt, KDF_PARAMS.keylen, {
    N: KDF_PARAMS.cost,
    r: KDF_PARAMS.blockSize,
    p: KDF_PARAMS.parallelization,
    maxmem: KDF_PARAMS.maxmem,
  });
}

/**
 * Empaqueta y cifra datos en memoria, produciendo un único objeto de bóveda autenticada.
 * @param {object} payload - Objeto de configuración a cifrar.
 * @param {string} passphrase - Contraseña de desbloqueo (nunca se guarda).
 * @returns {object} Objeto serializable con metadatos y ciphertext.
 */
export function packVault(payload, passphrase) {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('VAULT_INVALID_PAYLOAD: El contenido a cifrar debe ser un objeto válido.');
  }

  const plaintext = JSON.stringify(payload);
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const key = deriveKey(passphrase, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(VAULT_AAD, 'utf8'));

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    format: VAULT_FORMAT,
    version: VAULT_VERSION,
    createdAt: new Date().toISOString(),
    kdf: {
      algorithm: KDF_PARAMS.algorithm,
      salt: salt.toString('base64'),
      cost: KDF_PARAMS.cost,
      blockSize: KDF_PARAMS.blockSize,
      parallelization: KDF_PARAMS.parallelization,
      keylen: KDF_PARAMS.keylen,
    },
    cipher: {
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      aad: VAULT_AAD,
    },
    ciphertext: encrypted.toString('base64'),
  };
}

/**
 * Descifra y valida un objeto de bóveda autenticada usando la frase de paso.
 * @param {object|string} vaultData - Objeto o string JSON de la bóveda.
 * @param {string} passphrase - Contraseña de desbloqueo.
 * @returns {object} El payload descifrado en memoria.
 */
export function unlockVault(vaultData, passphrase) {
  let vault = vaultData;
  if (typeof vault === 'string') {
    try {
      vault = JSON.parse(vault);
    } catch {
      throw new Error('VAULT_CORRUPTED_FILE: El archivo no es un JSON válido.');
    }
  }

  if (!vault || typeof vault !== 'object') {
    throw new Error('VAULT_INVALID_FORMAT: El formato del archivo de bóveda no es válido.');
  }

  if (vault.format !== VAULT_FORMAT || vault.version !== VAULT_VERSION) {
    throw new Error(`VAULT_UNSUPPORTED_VERSION: Formato no reconocido o versión incompatible (${vault.format} v${vault.version}).`);
  }

  if (!vault.kdf?.salt || !vault.cipher?.iv || !vault.cipher?.authTag || !vault.ciphertext) {
    throw new Error('VAULT_MALFORMED_HEADER: Faltan parámetros criptográficos esenciales en la cabecera.');
  }

  const salt = Buffer.from(vault.kdf.salt, 'base64');
  const iv = Buffer.from(vault.cipher.iv, 'base64');
  const authTag = Buffer.from(vault.cipher.authTag, 'base64');
  const ciphertext = Buffer.from(vault.ciphertext, 'base64');

  const key = deriveKey(passphrase, salt);

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(vault.cipher.aad || VAULT_AAD, 'utf8'));
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    const parsed = JSON.parse(decrypted.toString('utf8'));
    return parsed;
  } catch (error) {
    // Si la clave es errónea o el texto fue manipulado, GCM falla en setAuthTag/final.
    throw new Error('VAULT_AUTH_FAILED: Contraseña incorrecta o el archivo de la bóveda ha sido alterado.');
  }
}
