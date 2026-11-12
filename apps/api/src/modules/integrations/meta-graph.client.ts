import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MetaDebugTokenResult {
  isValid: boolean;
  appId: string | null;
  userId: string | null;
  userName: string | null;
  scopes: string[];
  expiresAt: Date | null;
  errorCode: number | null;
  errorMessage: string | null;
}

export interface MetaBusinessPortfolioResult {
  id: string;
  name: string;
  verificationStatus: string | null;
}

export interface MetaPageResult {
  id: string;
  name: string;
  username: string | null;
  category: string | null;
  tasks: string[];
  instagram: { id: string; username: string | null; name: string | null } | null;
}

export interface MetaAdAccountResult {
  id: string;
  name: string;
  accountStatus: number | null;
  currency: string | null;
  timezoneName: string | null;
  businessId: string | null;
}

export interface MetaDiscoveryResult {
  portfolios: MetaBusinessPortfolioResult[];
  pages: MetaPageResult[];
  adAccounts: MetaAdAccountResult[];
}

export class MetaGraphError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly code: number | null = null,
  ) {
    super(message);
    this.name = 'MetaGraphError';
  }
}

interface GraphErrorBody {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
  };
}

const PAGE_LIMIT = 10;

/**
 * Thin, mockable wrapper around the Meta Graph API. Tokens are only used for
 * outbound calls and are never included in errors or logs.
 */
@Injectable()
export class MetaGraphClient {
  private readonly logger = new Logger(MetaGraphClient.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('meta.appId') &&
        this.configService.get<string>('meta.appSecret'),
    );
  }

  getScopes(): string[] {
    return this.configService.get<string[]>('meta.scopes') ?? [];
  }

  buildAuthorizationUrl(state: string): string {
    const appId = this.requireSetting('meta.appId');
    const redirectUri = this.getRedirectUri();
    const version = this.configService.get<string>('meta.apiVersion') ?? 'v23.0';
    const dialogBase =
      this.configService.get<string>('meta.dialogBaseUrl') ??
      'https://www.facebook.com';

    const url = new URL(`${dialogBase.replace(/\/$/, '')}/${version}/dialog/oauth`);
    url.searchParams.set('client_id', appId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', this.getScopes().join(','));

    return url.toString();
  }

  async exchangeCodeForToken(
    code: string,
  ): Promise<{ accessToken: string; expiresAt: Date | null }> {
    const response = await this.request<{
      access_token?: string;
      expires_in?: number;
    }>('oauth/access_token', {
      client_id: this.requireSetting('meta.appId'),
      client_secret: this.requireSetting('meta.appSecret'),
      redirect_uri: this.getRedirectUri(),
      code,
    });

    if (!response.access_token) {
      throw new MetaGraphError('Meta did not return an access token');
    }

    // Short-lived tokens are exchanged for long-lived tokens when possible.
    try {
      const longLived = await this.request<{
        access_token?: string;
        expires_in?: number;
      }>('oauth/access_token', {
        grant_type: 'fb_exchange_token',
        client_id: this.requireSetting('meta.appId'),
        client_secret: this.requireSetting('meta.appSecret'),
        fb_exchange_token: response.access_token,
      });

      if (longLived.access_token) {
        return {
          accessToken: longLived.access_token,
          expiresAt: longLived.expires_in
            ? new Date(Date.now() + longLived.expires_in * 1000)
            : null,
        };
      }
    } catch (error) {
      this.logger.warn(
        `Long-lived Meta token exchange failed, keeping the short-lived token: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    return {
      accessToken: response.access_token,
      expiresAt: response.expires_in
        ? new Date(Date.now() + response.expires_in * 1000)
        : null,
    };
  }

  async debugToken(inputToken: string): Promise<MetaDebugTokenResult> {
    const appAccessToken = `${this.requireSetting('meta.appId')}|${this.requireSetting(
      'meta.appSecret',
    )}`;
    const response = await this.request<{
      data?: {
        app_id?: string;
        user_id?: string;
        is_valid?: boolean;
        scopes?: string[];
        expires_at?: number;
        error?: { code?: number; message?: string };
      };
    }>('debug_token', {
      input_token: inputToken,
      access_token: appAccessToken,
    });
    const data = response.data ?? {};

    return {
      isValid: data.is_valid === true,
      appId: data.app_id ?? null,
      userId: data.user_id ?? null,
      userName: null,
      scopes: data.scopes ?? [],
      expiresAt: data.expires_at
        ? new Date(data.expires_at * 1000)
        : null,
      errorCode: data.error?.code ?? null,
      errorMessage: data.error?.message ?? null,
    };
  }

  async discoverAssets(accessToken: string): Promise<MetaDiscoveryResult> {
    const [portfolioBody, pageBody, adAccountBody] = await Promise.all([
      this.requestAll<{
        id: string;
        name?: string;
        verification_status?: string;
      }>('me/businesses', {
        fields: 'id,name,verification_status',
        limit: 100,
        access_token: accessToken,
      }),
      this.requestAll<{
        id: string;
        name?: string;
        username?: string;
        category?: string;
        tasks?: string[];
        instagram_business_account?: {
          id: string;
          username?: string;
          name?: string;
        };
      }>('me/accounts', {
        fields:
          'id,name,username,category,tasks,instagram_business_account{id,username,name}',
        limit: 100,
        access_token: accessToken,
      }),
      this.requestAll<{
        id: string;
        name?: string;
        account_status?: number;
        currency?: string;
        timezone_name?: string;
        business?: { id?: string };
      }>('me/adaccounts', {
        fields: 'id,name,account_status,currency,timezone_name,business{id}',
        limit: 100,
        access_token: accessToken,
      }),
    ]);

    return {
      portfolios: portfolioBody.map((entry) => ({
        id: entry.id,
        name: entry.name ?? entry.id,
        verificationStatus: entry.verification_status ?? null,
      })),
      pages: pageBody.map((entry) => ({
        id: entry.id,
        name: entry.name ?? entry.id,
        username: entry.username ?? null,
        category: entry.category ?? null,
        tasks: entry.tasks ?? [],
        instagram: entry.instagram_business_account
          ? {
              id: entry.instagram_business_account.id,
              username: entry.instagram_business_account.username ?? null,
              name: entry.instagram_business_account.name ?? null,
            }
          : null,
      })),
      adAccounts: adAccountBody.map((entry) => ({
        id: entry.id,
        name: entry.name ?? entry.id,
        accountStatus: entry.account_status ?? null,
        currency: entry.currency ?? null,
        timezoneName: entry.timezone_name ?? null,
        businessId: entry.business?.id ?? null,
      })),
    };
  }

  /** Best-effort permission revocation when a business disconnects. */
  async revokePermissions(accessToken: string): Promise<void> {
    try {
      await this.request('me/permissions', { access_token: accessToken }, 'DELETE');
    } catch (error) {
      this.logger.warn(
        `Meta permission revocation failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private getRedirectUri(): string {
    return this.requireSetting('meta.redirectUri');
  }

  private requireSetting(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new MetaGraphError(
        'Meta integration is not configured. Set META_APP_ID, META_APP_SECRET and META_REDIRECT_URI.',
        503,
      );
    }

    return value;
  }

  private get baseUrl(): string {
    const base =
      this.configService.get<string>('meta.graphBaseUrl') ??
      'https://graph.facebook.com';
    const version = this.configService.get<string>('meta.apiVersion') ?? 'v23.0';

    return `${base.replace(/\/$/, '')}/${version}`;
  }

  private async requestAll<T extends { id: string }>(
    path: string,
    params: Record<string, string | number>,
  ): Promise<T[]> {
    const items: T[] = [];
    let next: string | null = this.buildUrl(path, params);
    let page = 0;

    while (next && page < PAGE_LIMIT) {
      const response: {
        data?: T[];
        paging?: { next?: string };
      } = await this.fetchJson(next, 'GET');
      items.push(...(response.data ?? []));
      next = response.paging?.next ?? null;
      page += 1;
    }

    return items;
  }

  private async request<T>(
    path: string,
    params: Record<string, string | number>,
    method: 'GET' | 'DELETE' = 'GET',
  ): Promise<T> {
    return this.fetchJson<T>(this.buildUrl(path, params), method);
  }

  private buildUrl(
    path: string,
    params: Record<string, string | number>,
  ): string {
    const url = new URL(`${this.baseUrl}/${path.replace(/^\//, '')}`);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    return url.toString();
  }

  private async fetchJson<T>(
    url: string,
    method: 'GET' | 'DELETE',
  ): Promise<T> {
    const response = await fetch(url, { method });

    if (!response.ok) {
      let body: GraphErrorBody = {};

      try {
        body = (await response.json()) as GraphErrorBody;
      } catch {
        // The Graph API occasionally returns HTML error pages.
      }

      throw new MetaGraphError(
        body.error?.message ?? `Meta Graph API request failed (${response.status})`,
        response.status,
        body.error?.code ?? null,
      );
    }

    return (await response.json()) as T;
  }
}
