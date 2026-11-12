import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const FORMAT_PREFIX = 'v1';

/**
 * Encrypts provider credentials before they are persisted. The plaintext token
 * only exists in memory while a Graph API request is in flight.
 */
@Injectable()
export class IntegrationCryptoService {
  private readonly key: Buffer;
  readonly keyVersion = 1;

  constructor(configService: ConfigService) {
    const configured = configService.get<string>('integrations.encryptionKey');

    if (configured) {
      this.key = IntegrationCryptoService.parseKey(configured);
    } else if (configService.get<string>('nodeEnv') === 'production') {
      throw new Error(
        'INTEGRATION_ENCRYPTION_KEY is required in production to protect provider credentials',
      );
    } else {
      // Development and test environments derive a stable local key so tokens
      // remain decryptable across restarts without committing a secret.
      const seed = configService.get<string>('jwt.accessSecret') ?? 'adpilot-local';
      this.key = createHash('sha256')
        .update(`adpilot-development-integration-key:${seed}`)
        .digest();
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      FORMAT_PREFIX,
      iv.toString('base64'),
      tag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  decrypt(payload: string): string {
    const [version, ivValue, tagValue, ciphertextValue] = payload.split(':');

    if (
      version !== FORMAT_PREFIX ||
      !ivValue ||
      !tagValue ||
      !ciphertextValue
    ) {
      throw new Error('Unsupported encrypted credential format');
    }

    try {
      const decipher = createDecipheriv(
        ALGORITHM,
        this.key,
        Buffer.from(ivValue, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(tagValue, 'base64'));

      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextValue, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Never include the credential or key material in the error.
      throw new Error('Integration credential could not be decrypted');
    }
  }

  private static parseKey(value: string): Buffer {
    const trimmed = value.trim();
    const decoded = /^[0-9a-f]{64}$/i.test(trimmed)
      ? Buffer.from(trimmed, 'hex')
      : Buffer.from(trimmed, 'base64');

    if (decoded.length !== KEY_LENGTH) {
      throw new Error(
        'INTEGRATION_ENCRYPTION_KEY must decode to 32 bytes (base64 or 64-character hex)',
      );
    }

    return decoded;
  }
}
