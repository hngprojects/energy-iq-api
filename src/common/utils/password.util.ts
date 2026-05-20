import * as crypto from 'node:crypto';

export class PasswordUtil {
  static generateResetToken(length: number = 32): string {
    const hex = crypto.randomBytes(length).toString('hex');
    return hex;
  }
}
