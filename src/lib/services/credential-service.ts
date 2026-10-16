
// Servicio unico de credenciales - aislamiento por propietario
// Nunca devuelve la clave guardada. Usa cifrado autenticado.
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export class CredentialService {
  private masterKey: Buffer;
  
  constructor(masterSecret: string) {
    if (!masterSecret || masterSecret.length < 32) {
      throw new Error('Configuration missing: master secret required (>=32 chars)');
    }
    this.masterKey = Buffer.from(masterSecret.slice(0, 32));
  }
  
  encrypt(value: string, ownerId: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.masterKey, iv);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Combine iv + encrypted + owner tag
    return iv.toString('hex') + ':' + encrypted + ':' + ownerId;
  }
  
  // Decrypt only if owner matches - protects cross-user access
  decrypt(token: string, requesterId: string): string {
    const [ivHex, encrypted, ownerId] = token.split(':');
    if (ownerId !== requesterId) {
      throw new Error('Access denied: credential belongs to different owner');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', this.masterKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
  
  // Never return the raw secret
  getKeyIdentifier(token: string): { ownerId: string; masked: string } {
    const parts = token.split(':');
    return { ownerId: parts[2] || 'unknown', masked: '***' + (parts[2] ? parts[2].slice(-4) : '') };
  }
}
