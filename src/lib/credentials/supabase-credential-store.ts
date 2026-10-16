import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CredentialStoreError,
  type CredentialRecord,
  type CredentialStore,
  type EncryptedCredentialPayload,
} from './credential-store';

/**
 * Store durable sobre Supabase.
 *
 * - Usa el cliente de servidor provisto por el factory (clave anon + token del
 *   usuario; NUNCA service_role).
 * - Filtra SIEMPRE por owner_id, ademas de la politica RLS de la tabla.
 * - Persiste iv, auth_tag, ciphertext y algorithm por separado; nunca la API key.
 * - Los errores del proveedor de datos se convierten en CredentialStoreError sin
 *   exponer mensajes internos.
 */

export const CREDENTIALS_TABLE = 'user_provider_credentials';

const SELECTED_COLUMNS =
  'credential_id, owner_id, provider_id, algorithm, iv, auth_tag, ciphertext, created_at';

interface CredentialRow {
  credential_id?: unknown;
  owner_id?: unknown;
  provider_id?: unknown;
  algorithm?: unknown;
  iv?: unknown;
  auth_tag?: unknown;
  ciphertext?: unknown;
  created_at?: unknown;
}

function mapRow(row: CredentialRow): CredentialRecord | null {
  if (
    typeof row.credential_id !== 'string' ||
    typeof row.owner_id !== 'string' ||
    typeof row.provider_id !== 'string' ||
    typeof row.algorithm !== 'string' ||
    typeof row.iv !== 'string' ||
    typeof row.auth_tag !== 'string' ||
    typeof row.ciphertext !== 'string'
  ) {
    return null;
  }
  const encrypted: EncryptedCredentialPayload = {
    algorithm: row.algorithm,
    iv: row.iv,
    authTag: row.auth_tag,
    ciphertext: row.ciphertext,
  };
  return {
    credentialId: row.credential_id,
    ownerId: row.owner_id,
    providerId: row.provider_id,
    encrypted,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
  };
}

export class SupabaseCredentialStore implements CredentialStore {
  constructor(private readonly client: SupabaseClient) {}

  async create(input: {
    ownerId: string;
    providerId: string;
    credentialId: string;
    encrypted: EncryptedCredentialPayload;
    createdAt: string;
  }): Promise<void> {
    const { error } = await this.client.from(CREDENTIALS_TABLE).insert({
      owner_id: input.ownerId,
      provider_id: input.providerId,
      credential_id: input.credentialId,
      algorithm: input.encrypted.algorithm,
      iv: input.encrypted.iv,
      auth_tag: input.encrypted.authTag,
      ciphertext: input.encrypted.ciphertext,
      created_at: input.createdAt,
    });
    if (error) throw new CredentialStoreError();
  }

  async listByOwner(ownerId: string): Promise<CredentialRecord[]> {
    const { data, error } = await this.client
      .from(CREDENTIALS_TABLE)
      .select(SELECTED_COLUMNS)
      .eq('owner_id', ownerId);

    if (error) throw new CredentialStoreError();
    if (!Array.isArray(data)) return [];

    const records: CredentialRecord[] = [];
    for (const row of data as CredentialRow[]) {
      const record = mapRow(row);
      if (record) records.push(record);
    }
    return records;
  }

  async findByOwnerAndId(ownerId: string, credentialId: string): Promise<CredentialRecord | null> {
    const { data, error } = await this.client
      .from(CREDENTIALS_TABLE)
      .select(SELECTED_COLUMNS)
      .eq('owner_id', ownerId)
      .eq('credential_id', credentialId)
      .maybeSingle();

    if (error) throw new CredentialStoreError();
    if (!data) return null;
    return mapRow(data as CredentialRow);
  }

  async deleteByOwnerAndId(ownerId: string, credentialId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from(CREDENTIALS_TABLE)
      .delete()
      .eq('owner_id', ownerId)
      .eq('credential_id', credentialId)
      .select('credential_id');

    if (error) throw new CredentialStoreError();
    return Array.isArray(data) && data.length > 0;
  }
}
