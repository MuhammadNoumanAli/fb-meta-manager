import { ConfigService } from '@nestjs/config';
import { IntegrationCryptoService } from './integration-crypto.service';

const configWith = (values: Record<string, unknown>): ConfigService =>
  ({
    get: (key: string) => values[key],
  }) as unknown as ConfigService;

describe('IntegrationCryptoService', () => {
  const token = 'EAAG-example-access-token-value';

  it('round-trips credentials with a derived local key', () => {
    const service = new IntegrationCryptoService(
      configWith({ nodeEnv: 'test' }),
    );

    const encrypted = service.encrypt(token);

    expect(encrypted).not.toContain(token);
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(service.decrypt(encrypted)).toBe(token);
  });

  it('produces a unique ciphertext for the same plaintext', () => {
    const service = new IntegrationCryptoService(
      configWith({ nodeEnv: 'test' }),
    );

    expect(service.encrypt(token)).not.toBe(service.encrypt(token));
  });

  it('rejects tampered credentials', () => {
    const service = new IntegrationCryptoService(
      configWith({ nodeEnv: 'test' }),
    );
    const [version, iv, tag, ciphertext] = service.encrypt(token).split(':');
    const tampered = Buffer.from(ciphertext, 'base64');
    tampered[0] ^= 0xff;

    expect(() =>
      service.decrypt([version, iv, tag, tampered.toString('base64')].join(':')),
    ).toThrow('Integration credential could not be decrypted');
  });

  it('accepts a base64 32-byte key', () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const service = new IntegrationCryptoService(
      configWith({
        nodeEnv: 'production',
        'integrations.encryptionKey': key,
      }),
    );

    expect(service.decrypt(service.encrypt(token))).toBe(token);
  });

  it('rejects a malformed configured key', () => {
    expect(
      () =>
        new IntegrationCryptoService(
          configWith({
            nodeEnv: 'production',
            'integrations.encryptionKey': 'too-short',
          }),
        ),
    ).toThrow('INTEGRATION_ENCRYPTION_KEY must decode to 32 bytes');
  });

  it('requires a configured key in production', () => {
    expect(
      () =>
        new IntegrationCryptoService(
          configWith({ nodeEnv: 'production' }),
        ),
    ).toThrow('INTEGRATION_ENCRYPTION_KEY is required in production');
  });
});
