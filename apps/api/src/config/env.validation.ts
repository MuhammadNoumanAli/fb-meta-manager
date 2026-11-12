import * as Joi from 'joi';

/**
 * Centralised environment validation. The API refuses to boot when a required
 * value is missing or malformed, so configuration errors surface immediately.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  FRONTEND_ORIGIN: Joi.string().uri().default('http://localhost:5173'),

  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().port().default(3306),
  DATABASE_NAME: Joi.string().required(),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().allow('').required(),
  DATABASE_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  JWT_ACCESS_SECRET: Joi.string().allow('').when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
  }),
  JWT_REFRESH_SECRET: Joi.string().allow('').when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
  }),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),

  META_APP_ID: Joi.string().allow('').optional(),
  META_APP_SECRET: Joi.string().allow('').optional(),
  META_REDIRECT_URI: Joi.string().allow('').optional(),
  META_API_VERSION: Joi.string().allow('').optional(),
  META_WEBHOOK_VERIFY_TOKEN: Joi.string().allow('').optional(),

  WHATSAPP_PROVIDER: Joi.string().allow('').optional(),
  WHATSAPP_ACCESS_TOKEN: Joi.string().allow('').optional(),
  WHATSAPP_PHONE_NUMBER_ID: Joi.string().allow('').optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: Joi.string().allow('').optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: Joi.string().allow('').optional(),

  AWS_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
  AWS_REGION: Joi.string().allow('').optional(),
  AWS_S3_BUCKET: Joi.string().allow('').optional(),

  AI_PROVIDER: Joi.string().allow('').optional(),
  AI_API_KEY: Joi.string().allow('').optional(),
}).unknown(true);

export const validateEnvironment = (config: Record<string, unknown>) => {
  const { error, value } = envValidationSchema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (error) {
    const details = error.details.map((detail) => detail.message).join('; ');
    throw new Error(`Environment validation failed: ${details}`);
  }

  return value as Record<string, unknown>;
};
