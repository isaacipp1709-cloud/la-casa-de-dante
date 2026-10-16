/**
 * Contrato de persistencia de credenciales BYOK.
 *
 * Toda operacion esta acotada al propietario: la implementacion debe filtrar
 * siempre por ownerId. Nunca se persiste ni se devuelve la API key en claro:
 * solo el sobre cifrado (algorithm, iv, authTag, ciphertext).
 */

export interface EncryptedCredentialPayload {
  algorithm: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export interface CredentialRecord {
  credentialId: string;
  ownerId: string;
  providerId: string;
  encrypted: EncryptedCredentialPayload;
  createdAt: string;
}

export interface CredentialStore {
  create(input: {
    ownerId: string;
    providerId: string;
    credentialId: string;
    encrypted: EncryptedCredentialPayload;
    createdAt: string;
  }): Promise<void>;

  listByOwner(ownerId: string): Promise<CredentialRecord[]>;

  findByOwnerAndId(ownerId: string, credentialId: string): Promise<CredentialRecord | null>;

  deleteByOwnerAndId(ownerId: string, credentialId: string): Promise<boolean>;
}

/** Fallo de persistencia sin detalles internos (no se filtra el error del proveedor de datos). */
export class CredentialStoreError extends Error {
  constructor(message = 'Credential store unavailable') {
    super(message);
    this.name = 'CredentialStoreError';
  }
}

function cloneRecord(record: CredentialRecord): CredentialRecord {
  return { ...record, encrypted: { ...record.encrypted } };
}

/**
 * Store en memoria del proceso. Es el fallback de desarrollo cuando no hay
 * configuracion de Supabase: NO es durable, los datos se pierden al reiniciar.
 */
export class InMemoryCredentialStore implements CredentialStore {
  private readonly records = new Map<string, CredentialRecord>();

  async create(input: {
    ownerId: string;
    providerId: string;
    credentialId: string;
    encrypted: EncryptedCredentialPayload;
    createdAt: string;
  }): Promise<void> {
    const record: CredentialRecord = {
      credentialId: input.credentialId,
      ownerId: input.ownerId,
      providerId: input.providerId,
      encrypted: { ...input.encrypted },
      createdAt: input.createdAt,
    };
    this.records.set(record.credentialId, record);
  }

  async listByOwner(ownerId: string): Promise<CredentialRecord[]> {
    return Array.from(this.records.values())
      .filter((record) => record.ownerId === ownerId)
      .map(cloneRecord);
  }

  async findByOwnerAndId(ownerId: string, credentialId: string): Promise<CredentialRecord | null> {
    const record = this.records.get(credentialId);
    if (!record || record.ownerId !== ownerId) return null;
    return cloneRecord(record);
  }

  async deleteByOwnerAndId(ownerId: string, credentialId: string): Promise<boolean> {
    const record = this.records.get(credentialId);
    if (!record || record.ownerId !== ownerId) return false;
    this.records.delete(credentialId);
    return true;
  }
}
