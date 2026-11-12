export interface AppConfiguration {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  frontendOrigin: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    logging: boolean;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  meta: {
    appId: string;
    appSecret: string;
    redirectUri: string;
    apiVersion: string;
    webhookVerifyToken: string;
    graphBaseUrl: string;
    dialogBaseUrl: string;
    scopes: string[];
  };
  integrations: {
    encryptionKey: string;
  };
  whatsapp: {
    provider: string;
    accessToken: string;
    phoneNumberId: string;
    businessAccountId: string;
    webhookVerifyToken: string;
  };
  ai: {
    provider: string;
    apiKey: string;
  };
}

const asNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default (): AppConfiguration => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: asNumber(process.env.PORT, 3000),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  database: {
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: asNumber(process.env.DATABASE_PORT, 3306),
    name: process.env.DATABASE_NAME ?? 'adpilot',
    user: process.env.DATABASE_USER ?? '',
    password: process.env.DATABASE_PASSWORD ?? '',
    logging: process.env.DATABASE_LOGGING === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: asNumber(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  meta: {
    appId: process.env.META_APP_ID ?? '',
    appSecret: process.env.META_APP_SECRET ?? '',
    redirectUri: process.env.META_REDIRECT_URI ?? '',
    apiVersion: process.env.META_API_VERSION ?? 'v23.0',
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN ?? '',
    graphBaseUrl: process.env.META_GRAPH_BASE_URL ?? 'https://graph.facebook.com',
    dialogBaseUrl: process.env.META_DIALOG_BASE_URL ?? 'https://www.facebook.com',
    scopes: (process.env.META_OAUTH_SCOPES ??
      'ads_management,business_management,pages_show_list,pages_read_engagement,instagram_basic,leads_retrieval')
      .split(',')
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0),
  },
  integrations: {
    encryptionKey: process.env.INTEGRATION_ENCRYPTION_KEY ?? '',
  },
  whatsapp: {
    provider: process.env.WHATSAPP_PROVIDER ?? '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? '',
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? '',
  },
  ai: {
    provider: process.env.AI_PROVIDER ?? '',
    apiKey: process.env.AI_API_KEY ?? '',
  },
});
