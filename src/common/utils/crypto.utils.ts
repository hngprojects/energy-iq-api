import * as crypto from 'crypto';
export class SecretManager {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12;
  private static readonly TAG_LENGTH = 16;

  private static getKey(): Buffer {
    const key = process.env.SECRET_MANAGER_ENCRYPTION_KEY;
    if (!key || key.length < 32)
      throw new Error('ENCRYPTION_KEY must be at least 32 characters');

    return Buffer.from(key, 'utf8').subarray(0, 32); // ensure 32 bytes
  }

  static encrypt(plainText: string): string {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.getKey(), iv);

    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  static decrypt(cipherText: string): string {
    const data = Buffer.from(cipherText, 'base64');
    const iv = data.subarray(0, this.IV_LENGTH);
    const tag = data.subarray(this.IV_LENGTH, this.IV_LENGTH + this.TAG_LENGTH);
    const encrypted = data.subarray(this.IV_LENGTH + this.TAG_LENGTH);

    const decipher = crypto.createDecipheriv(this.ALGORITHM, this.getKey(), iv);
    decipher.setAuthTag(tag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }
}
