import crypto from 'node:crypto';
import { BYOK_PROVIDER_IDS, isAllowedProviderId } from '../credentials/provider-catalog';

/**
 * Servicio unico de credenciales BYOK.
 * - Cifrado autenticado AES-256-GCM (authTag verificado al descifrar).
 * - CLAVE MAESTRA nunca se guarda en el repositorio: se deriva de CREDENTIAL_MASTER_SECRET.
 * - Aislamiento por propietario: toda lectura exige ownerId coincidente.
 * - Nunca expone la clave en texto plano fuera del resultado de resolveForOwner.
 */

export const CREDENTIAL_ALGORITHM = 'aes-256-gcm' as const;
export const CREDENTIAL_KEY_BYTES = 32;
export const CREDENTIAL_IV_BYTES = 12;
export const CREDENTIAL_SALT = 'dante-byok-v1';

/** Proveedores permitidos, derivados del catalogo compartido con la UI. */
export const PROVIDER_ALLOWLIST: readonly string[] = BYOK_PROVIDER_IDS;
export type AllowedProviderId = string;

export function isAllowedProvider(value: unknown): value is AllowedProviderId {
  return isAllowedProviderId(value);
}

/** Configuracion ausente o invalida (nunca hay valor por defecto silencioso). */
export class CredentialConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialConfigurationError';
  }
}

/** Error generico: no revela si la credencial existe o pertenece a otro usuario. */
export class CredentialNotFoundError extends Error {
  constructor() {
    super('Credential not found');
    this.name = 'CredentialNotFoundError';
  }
}

/** Error generico de integridad: authTag invalido o sobre manipulado. */
export class CredentialIntegrityError extends Error {
  constructor() {
    super('Invalid credential');
    this.name = 'CredentialIntegrityError';
  }
}

export class UnsupportedProviderError extends Error {
  constructor() {
    super('Provider not allowed');
    this.name = 'UnsupportedProviderError';
  }
}

export interface EncryptedPayload {
  algorithm: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export interface CredentialRecord {
  credentialId: string;
  ownerId: string;
  providerId: string;
  model?: string;
  createdAt: string;
  encrypted: EncryptedPayload;
}

/** Metadatos seguros: nunca incluyen clave ni datos cifrados. */
export interface CredentialMetadata {
  credentialId: string;
  providerId: string;
  model?: string;
  createdAt: string;
  status: 'active';
}

/** Deriva la clave maestra de 32 bytes. Sin secreto -> configuración inválida. */
export function deriveMasterKey(masterSecret: string | undefined): Buffer {
  if (typeof masterSecret !== 'string' || masterSecret.length === 0) {
    throw new CredentialConfigurationError('CREDENTIAL_MASTER_SECRET is not configured');
  }
  return crypto.scryptSync(masterSecret, CREDENTIAL_SALT, CREDENTIAL_KEY_BYTES);
}

export class CredentialService {
  private readonly masterKey: Buffer;
  private readonly store: Map<string, CredentialRecord>;

  constructor(masterSecret: string | undefined, store?: Map<string, CredentialRecord>) {
    this.masterKey = deriveMasterKey(masterSecret);
    this.store = store ?? new Map<string, CredentialRecord>();
  }

  /** Cifra con IV aleatorio de 12 bytes y devuelve los campos por separado. */
  encrypt(plaintext: string): EncryptedPayload {
    const iv = crypto.randomBytes(CREDENTIAL_IV_BYTES);
    const cipher = crypto.createCipheriv(CREDENTIAL_ALGORITHM, this.masterKey, iv);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return { algorithm: CREDENTIAL_ALGORITHM, iv: iv.toString('hex'), authTag, ciphertext };
  }

  /** Descifra verificando el authTag. Cualquier fallo -> error generico. */
  decrypt(payload: EncryptedPayload): string {
    if (!payload || payload.algorithm !== CREDENTIAL_ALGORITHM) {
      throw new CredentialIntegrityError();
    }
    try {
      const decipher = crypto.createDecipheriv(
        CREDENTIAL_ALGORITHM,
        this.masterKey,
        Buffer.from(payload.iv, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));
      let plaintext = decipher.update(payload.ciphertext, 'hex', 'utf8');
      plaintext += decipher.final('utf8');
      return plaintext;
    } catch {
      throw new CredentialIntegrityError();
    }
  }

  /** Guarda la credencial asociada al propietario autenticado. Devuelve solo metadatos. */
  save(input: { ownerId: string; providerId: string; apiKey: string; model?: string }): CredentialMetadata {
    if (typeof input.ownerId !== 'string' || input.ownerId.length === 0) {
      throw new CredentialConfigurationError('ownerId is required');
    }
    if (!isAllowedProvider(input.providerId)) {
      throw new UnsupportedProviderError();
    }
    if (typeof input.apiKey !== 'string' || input.apiKey.trim().length === 0) {
      throw new CredentialConfigurationError('apiKey is required');
    }
    const record: CredentialRecord = {
      credentialId: crypto.randomUUID(),
      ownerId: input.ownerId,
      providerId: input.providerId,
      model: input.model,
      createdAt: new Date().toISOString(),
      encrypted: this.encrypt(input.apiKey),
    };
    this.store.set(record.credentialId, record);
    return toMetadata(record);
  }

  /**
   * Elimina la credencial y sus datos cifrados asociados.
   * Inexistente y ajena producen el MISMO error generico: no hay borrado cruzado.
   */
  deleteForOwner(credentialId: string, ownerId: string): void {
    const record = this.store.get(credentialId);
    if (!record || record.ownerId !== ownerId) {
      throw new CredentialNotFoundError();
    }
    this.store.delete(credentialId);
  }

  /** Metadatos del propietario autenticado unicamente. */
  listMetadata(ownerId: string): CredentialMetadata[] {
    return Array.from(this.store.values())
      .filter((record) => record.ownerId === ownerId)
      .map(toMetadata);
  }

  /**
   * Resuelve la credencial para su uso en chat.
   * Filtra por propietario: inexistente y ajena producen el MISMO error generico.
   */
  resolveForOwner(credentialId: string, ownerId: string): { providerId: string; model?: string; apiKey: string } {
    const record = this.store.get(credentialId);
    if (!record || record.ownerId !== ownerId) {
      throw new CredentialNotFoundError();
    }
    return {
      providerId: record.providerId,
      model: record.model,
      apiKey: this.decrypt(record.encrypted),
    };
  }

}

function toMetadata(record: CredentialRecord): CredentialMetadata {
  return {
    credentialId: record.credentialId,
    providerId: record.providerId,
    model: record.model,
    createdAt: record.createdAt,
    status: 'active',
  };
}
