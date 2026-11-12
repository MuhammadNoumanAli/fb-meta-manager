import { envValidationSchema, validateEnvironment } from './env.validation';

const validEnvironment = {
  DATABASE_HOST: '127.0.0.1',
  DATABASE_NAME: 'adpilot',
  DATABASE_USER: 'adpilot',
  DATABASE_PASSWORD: 'secret',
  REDIS_HOST: '127.0.0.1',
};

describe('environment validation', () => {
  it('accepts a valid development environment and applies defaults', () => {
    const value = validateEnvironment({ ...validEnvironment });

    expect(value.PORT).toBe(3000);
    expect(value.API_PREFIX).toBe('api/v1');
    expect(value.NODE_ENV).toBe('development');
  });

  it('rejects a missing required database variable', () => {
    expect(() => validateEnvironment({ ...validEnvironment, DATABASE_HOST: undefined })).toThrow(
      /DATABASE_HOST/,
    );
  });

  it('rejects an invalid port', () => {
    const { error } = envValidationSchema.validate(
      { ...validEnvironment, PORT: 'not-a-port' },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.message).toContain('PORT');
  });

  it('requires JWT secrets in production', () => {
    const { error } = envValidationSchema.validate(
      { ...validEnvironment, NODE_ENV: 'production' },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.message).toContain('JWT_ACCESS_SECRET');
  });

  it('accepts production with strong JWT secrets', () => {
    const { error } = envValidationSchema.validate(
      {
        ...validEnvironment,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
      },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeUndefined();
  });
});
