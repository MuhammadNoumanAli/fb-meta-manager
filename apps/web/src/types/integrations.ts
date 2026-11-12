export type MetaIntegrationStatus =
  | 'not_connected'
  | 'pending'
  | 'active'
  | 'expired'
  | 'revoked'
  | 'error';

export type MetaIntegrationHealth =
  | 'not_connected'
  | 'healthy'
  | 'attention'
  | 'expired'
  | 'revoked';

export type MetaConnectionMode = 'client_oauth' | 'system_user';

export interface MetaIntegrationAuthorization {
  connected: boolean;
  provider: string;
  status: MetaIntegrationStatus;
  connectionMode: MetaConnectionMode | null;
  externalUserId: string | null;
  externalUserName: string | null;
  tokenExpiresAt: string | null;
  lastValidatedAt: string | null;
  lastError: string | null;
  scopes: string[];
  grantedPermissions: string[];
  missingPermissions: string[];
  requiresReauthorization: boolean;
  health: MetaIntegrationHealth;
  authorizedByUserId: string | null;
  connectedAt: string | null;
}

export interface MetaAsset {
  id: string;
  externalId: string;
  name: string;
  detail: string | null;
  meta: Record<string, unknown>;
}

export interface MetaIntegrationAssets {
  businessPortfolios: MetaAsset[];
  pages: MetaAsset[];
  instagramAccounts: MetaAsset[];
  adAccounts: MetaAsset[];
}

export interface MetaIntegrationOverview {
  authorization: MetaIntegrationAuthorization;
  assets: MetaIntegrationAssets;
}

export type MetaTokenEventType =
  | 'authorized'
  | 'system_user_connected'
  | 'reauthorized'
  | 'validated'
  | 'permissions_changed'
  | 'expired'
  | 'revoked'
  | 'error'
  | 'discovered'
  | 'disconnected';

export interface MetaTokenEvent {
  id: string;
  eventType: MetaTokenEventType;
  detail: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface MetaOAuthStartResult {
  authorizationUrl: string;
  expiresAt: string;
}
