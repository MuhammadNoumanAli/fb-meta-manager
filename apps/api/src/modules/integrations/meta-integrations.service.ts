import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { IntegrationConnectionMode } from '../../common/enums/integration-connection-mode.enum';
import { IntegrationStatus } from '../../common/enums/integration-status.enum';
import { IntegrationTokenEventType } from '../../common/enums/integration-token-event-type.enum';
import { generateOpaqueToken } from '../../common/utilities/slug';
import type { RequestContext } from '../../common/utilities/request-context';
import { Business } from '../../database/entities/business.entity';
import { IntegrationAuthorization } from '../../database/entities/integration-authorization.entity';
import { IntegrationTokenEvent } from '../../database/entities/integration-token-event.entity';
import { MetaAdAccount } from '../../database/entities/meta-ad-account.entity';
import { MetaBusinessPortfolio } from '../../database/entities/meta-business-portfolio.entity';
import { MetaInstagramAccount } from '../../database/entities/meta-instagram-account.entity';
import { MetaOAuthState } from '../../database/entities/meta-oauth-state.entity';
import { MetaPage } from '../../database/entities/meta-page.entity';
import { AuditService } from '../audit/audit.service';
import { hashToken } from '../auth/tokens.service';
import { ConnectMetaSystemUserDto } from './dto/connect-system-user.dto';
import { StartMetaOAuthDto } from './dto/start-meta-oauth.dto';
import { IntegrationCryptoService } from './integration-crypto.service';
import {
  MetaDiscoveryResult,
  MetaGraphClient,
  MetaGraphError,
} from './meta-graph.client';

const PROVIDER = 'meta';
const STATE_TTL_MS = 10 * 60 * 1000;
const MONITOR_LOOKAHEAD_MS = 3 * 24 * 60 * 60 * 1000;
const MONITOR_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export interface MetaIntegrationStatusView {
  connected: boolean;
  provider: string;
  status: IntegrationStatus | 'not_connected';
  connectionMode: IntegrationConnectionMode | null;
  externalUserId: string | null;
  externalUserName: string | null;
  tokenExpiresAt: Date | null;
  lastValidatedAt: Date | null;
  lastError: string | null;
  scopes: string[];
  grantedPermissions: string[];
  missingPermissions: string[];
  requiresReauthorization: boolean;
  health: 'not_connected' | 'healthy' | 'attention' | 'expired' | 'revoked';
  authorizedByUserId: string | null;
  connectedAt: Date | null;
}

export interface MetaAssetView {
  id: string;
  externalId: string;
  name: string;
  detail: string | null;
  meta: Record<string, unknown>;
}

export interface MetaIntegrationOverview {
  authorization: MetaIntegrationStatusView;
  assets: {
    businessPortfolios: MetaAssetView[];
    pages: MetaAssetView[];
    instagramAccounts: MetaAssetView[];
    adAccounts: MetaAssetView[];
  };
}

export interface MetaOAuthStartResult {
  authorizationUrl: string;
  expiresAt: Date;
}

export interface MetaOAuthCallbackResult {
  redirectUrl: string;
  connected: boolean;
}

export interface MetaIntegrationEventView {
  id: string;
  eventType: IntegrationTokenEventType;
  detail: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface MonitorSweepResult {
  checked: number;
  revoked: number;
  refreshed: number;
}

@Injectable()
export class MetaIntegrationsService {
  private readonly logger = new Logger(MetaIntegrationsService.name);

  constructor(
    @InjectRepository(IntegrationAuthorization)
    private readonly authorizations: Repository<IntegrationAuthorization>,
    @InjectRepository(MetaOAuthState)
    private readonly oauthStates: Repository<MetaOAuthState>,
    @InjectRepository(MetaBusinessPortfolio)
    private readonly portfolios: Repository<MetaBusinessPortfolio>,
    @InjectRepository(MetaPage)
    private readonly pages: Repository<MetaPage>,
    @InjectRepository(MetaInstagramAccount)
    private readonly instagramAccounts: Repository<MetaInstagramAccount>,
    @InjectRepository(MetaAdAccount)
    private readonly adAccounts: Repository<MetaAdAccount>,
    @InjectRepository(IntegrationTokenEvent)
    private readonly tokenEvents: Repository<IntegrationTokenEvent>,
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    private readonly dataSource: DataSource,
    private readonly graphClient: MetaGraphClient,
    private readonly cryptoService: IntegrationCryptoService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async getOverview(businessId: string): Promise<MetaIntegrationOverview> {
    const authorization = await this.findAuthorization(businessId);

    return {
      authorization: this.toStatusView(authorization),
      assets: await this.loadAssets(businessId),
    };
  }

  async startOAuth(
    actorUserId: string,
    businessId: string,
    dto: StartMetaOAuthDto,
    context: RequestContext,
  ): Promise<MetaOAuthStartResult> {
    this.ensureConfigured();

    const rawState = generateOpaqueToken(32);
    const expiresAt = new Date(Date.now() + STATE_TTL_MS);

    await this.oauthStates.save(
      this.oauthStates.create({
        businessId,
        userId: actorUserId,
        stateHash: hashToken(rawState),
        redirectPath: dto.redirectPath ?? `/businesses/${businessId}`,
        expiresAt,
      }),
    );

    const business = await this.businesses.findOne({ where: { id: businessId } });

    await this.auditService.record({
      action: 'integration.oauth_started',
      actorUserId,
      tenantId: business?.tenantId ?? null,
      businessId,
      entityType: 'integration',
      metadata: { provider: PROVIDER },
      context,
    });

    return {
      authorizationUrl: this.graphClient.buildAuthorizationUrl(rawState),
      expiresAt,
    };
  }

  /**
   * Public OAuth callback. Returns a frontend redirect instead of a JSON body
   * so the browser lands back in the workspace after Meta redirects.
   */
  async handleOAuthCallback(
    code: string | undefined,
    state: string | undefined,
    error: string | undefined,
    context: RequestContext,
  ): Promise<MetaOAuthCallbackResult> {
    if (!state) {
      return this.failureRedirect('/workspaces', 'state_missing');
    }

    const record = await this.oauthStates.findOne({
      where: { stateHash: hashToken(state) },
    });

    if (!record) {
      return this.failureRedirect('/workspaces', 'state_invalid');
    }

    const fallbackPath = record.redirectPath ?? `/businesses/${record.businessId}`;

    if (error) {
      return this.failureRedirect(fallbackPath, 'access_denied');
    }

    if (!code) {
      return this.failureRedirect(fallbackPath, 'code_missing');
    }

    if (
      record.consumedAt ||
      record.expiresAt.getTime() <= Date.now()
    ) {
      return this.failureRedirect(fallbackPath, 'state_expired');
    }

    // Consume the state before exchanging the code so a replay is rejected even
    // when the exchange fails half way through.
    record.consumedAt = new Date();
    await this.oauthStates.save(record);

    this.ensureConfigured();

    try {
      const exchanged = await this.graphClient.exchangeCodeForToken(code);
      const debug = await this.graphClient.debugToken(exchanged.accessToken);

      if (!debug.isValid) {
        return this.failureRedirect(fallbackPath, 'token_invalid');
      }

      const existing = await this.findAuthorization(record.businessId);
      const authorization = await this.persistAuthorization({
        businessId: record.businessId,
        mode: IntegrationConnectionMode.CLIENT_OAUTH,
        token: exchanged.accessToken,
        tokenExpiresAt: debug.expiresAt ?? exchanged.expiresAt,
        grantedPermissions: debug.scopes,
        externalUserId: debug.userId,
        externalUserName: debug.userName,
        authorizedByUserId: record.userId,
        existing,
      });

      await this.recordTokenEvent(
        authorization,
        existing ? IntegrationTokenEventType.REAUTHORIZED : IntegrationTokenEventType.AUTHORIZED,
        { scopes: debug.scopes },
      );

      const business = await this.businesses.findOne({
        where: { id: record.businessId },
      });

      await this.auditService.record({
        action: existing ? 'integration.reconnected' : 'integration.connected',
        actorUserId: record.userId,
        tenantId: business?.tenantId ?? null,
        businessId: record.businessId,
        entityType: 'integration',
        entityId: authorization.id,
        metadata: {
          provider: PROVIDER,
          mode: IntegrationConnectionMode.CLIENT_OAUTH,
          grantedPermissions: debug.scopes,
        },
        context,
      });

      await this.tryDiscoverAssets(authorization, record.userId, context);

      return {
        redirectUrl: this.successRedirect(
          fallbackPath,
          existing ? 'reconnected' : 'connected',
        ),
        connected: true,
      };
    } catch (caught) {
      this.logger.warn(
        `Meta OAuth callback failed: ${
          caught instanceof Error ? caught.message : 'unknown error'
        }`,
      );
      await this.auditService.record({
        action: 'integration.oauth_failed',
        actorUserId: record.userId,
        businessId: record.businessId,
        entityType: 'integration',
        metadata: { provider: PROVIDER },
        context,
      });

      return this.failureRedirect(fallbackPath, 'meta_error');
    }
  }

  async connectSystemUser(
    actorUserId: string,
    businessId: string,
    dto: ConnectMetaSystemUserDto,
    context: RequestContext,
  ): Promise<MetaIntegrationOverview> {
    this.ensureConfigured();

    let debug;
    try {
      debug = await this.graphClient.debugToken(dto.accessToken);
    } catch (caught) {
      throw new BadGatewayException(this.describeGraphFailure(caught));
    }

    if (!debug.isValid) {
      throw new BadRequestException(
        debug.errorMessage ?? 'Meta rejected this system user access token',
      );
    }

    const existing = await this.findAuthorization(businessId);
    const authorization = await this.persistAuthorization({
      businessId,
      mode: IntegrationConnectionMode.SYSTEM_USER,
      token: dto.accessToken,
      tokenExpiresAt: dto.tokenExpiresAt
        ? new Date(dto.tokenExpiresAt)
        : debug.expiresAt,
      grantedPermissions: debug.scopes,
      externalUserId: debug.userId,
      externalUserName: debug.userName,
      authorizedByUserId: actorUserId,
      existing,
    });

    await this.recordTokenEvent(
      authorization,
      IntegrationTokenEventType.SYSTEM_USER_CONNECTED,
      { scopes: debug.scopes },
    );

    const business = await this.businesses.findOne({ where: { id: businessId } });

    await this.auditService.record({
      action: 'integration.system_user_connected',
      actorUserId,
      tenantId: business?.tenantId ?? null,
      businessId,
      entityType: 'integration',
      entityId: authorization.id,
      metadata: {
        provider: PROVIDER,
        mode: IntegrationConnectionMode.SYSTEM_USER,
        grantedPermissions: debug.scopes,
      },
      context,
    });

    await this.tryDiscoverAssets(authorization, actorUserId, context);

    return this.getOverview(businessId);
  }

  async validate(
    actorUserId: string,
    businessId: string,
    context: RequestContext,
  ): Promise<MetaIntegrationOverview> {
    const authorization = await this.requireAuthorization(businessId);
    await this.performValidation(authorization, actorUserId, context);

    return this.getOverview(businessId);
  }

  async discover(
    actorUserId: string,
    businessId: string,
    context: RequestContext,
  ): Promise<MetaIntegrationOverview> {
    const authorization = await this.requireAuthorization(businessId);
    const token = this.decryptToken(authorization);

    if (!token) {
      throw new BadRequestException(
        'Reconnect Meta before refreshing connected assets',
      );
    }

    const discovery = await this.callDiscovery(token);
    await this.syncAssets(authorization, discovery);
    await this.recordTokenEvent(
      authorization,
      IntegrationTokenEventType.DISCOVERED,
      { counts: this.assetCounts(discovery) },
    );

    const business = await this.businesses.findOne({ where: { id: businessId } });
    await this.auditService.record({
      action: 'integration.assets_discovered',
      actorUserId,
      tenantId: business?.tenantId ?? null,
      businessId,
      entityType: 'integration',
      entityId: authorization.id,
      metadata: this.assetCounts(discovery),
      context,
    });

    return this.getOverview(businessId);
  }

  async disconnect(
    actorUserId: string,
    businessId: string,
    context: RequestContext,
  ): Promise<MetaIntegrationOverview> {
    const authorization = await this.findAuthorization(businessId);

    if (!authorization) {
      return this.getOverview(businessId);
    }

    const token = this.decryptToken(authorization, false);

    if (token) {
      await this.graphClient.revokePermissions(token);
    }

    authorization.status = IntegrationStatus.REVOKED;
    authorization.accessTokenEncrypted = null;
    authorization.tokenExpiresAt = null;
    authorization.missingPermissions = authorization.scopes;
    authorization.lastError = null;
    await this.authorizations.save(authorization);

    await this.deleteAssets(authorization.id, businessId);
    await this.recordTokenEvent(
      authorization,
      IntegrationTokenEventType.DISCONNECTED,
    );

    const business = await this.businesses.findOne({ where: { id: businessId } });
    await this.auditService.record({
      action: 'integration.disconnected',
      actorUserId,
      tenantId: business?.tenantId ?? null,
      businessId,
      entityType: 'integration',
      entityId: authorization.id,
      metadata: { provider: PROVIDER },
      context,
    });

    return this.getOverview(businessId);
  }

  async listEvents(
    businessId: string,
    limit = 20,
  ): Promise<MetaIntegrationEventView[]> {
    const rows = await this.tokenEvents.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });

    return rows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      detail: row.detail,
      metadata: row.metadata,
      createdAt: row.createdAt,
    }));
  }

  /**
   * Foundation for the scheduled token monitor: validates tokens that are close
   * to expiry or have not been checked recently and downgrades invalid ones.
   */
  async monitorSweep(limit = 25): Promise<MonitorSweepResult> {
    const now = new Date();
    const soon = new Date(now.getTime() + MONITOR_LOOKAHEAD_MS);
    const staleBefore = new Date(now.getTime() - MONITOR_STALE_MS);

    const candidates = await this.authorizations
      .createQueryBuilder('authorization')
      .where('authorization.status = :active', { active: IntegrationStatus.ACTIVE })
      .andWhere(
        '(authorization.token_expires_at IS NOT NULL AND authorization.token_expires_at <= :soon) OR authorization.last_validated_at IS NULL OR authorization.last_validated_at <= :staleBefore',
        { soon, staleBefore },
      )
      .orderBy('authorization.last_validated_at', 'ASC')
      .take(Math.min(Math.max(limit, 1), 100))
      .getMany();

    let revoked = 0;
    let refreshed = 0;

    for (const authorization of candidates) {
      const before = authorization.status;
      try {
        await this.performValidation(authorization, null, null);
      } catch (error) {
        this.logger.warn(
          `Token monitor could not validate integration ${authorization.id}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }

      if (
        authorization.status === IntegrationStatus.REVOKED ||
        authorization.status === IntegrationStatus.EXPIRED
      ) {
        revoked += 1;
      } else if (before === IntegrationStatus.ACTIVE) {
        refreshed += 1;
      }
    }

    return { checked: candidates.length, revoked, refreshed };
  }

  private async performValidation(
    authorization: IntegrationAuthorization,
    actorUserId: string | null,
    context: RequestContext | null,
  ): Promise<void> {
    const token = this.decryptToken(authorization, false);

    if (!token) {
      authorization.status = IntegrationStatus.REVOKED;
      authorization.missingPermissions = authorization.scopes;
      authorization.lastError = 'The stored credential is no longer available';
      await this.authorizations.save(authorization);
      return;
    }

    let debug;
    try {
      debug = await this.graphClient.debugToken(token);
    } catch (caught) {
      authorization.lastError = this.describeGraphFailure(caught);
      authorization.status = IntegrationStatus.ERROR;
      await this.authorizations.save(authorization);
      await this.recordTokenEvent(
        authorization,
        IntegrationTokenEventType.ERROR,
        { message: authorization.lastError },
      );
      throw new BadGatewayException(authorization.lastError);
    }

    if (!debug.isValid) {
      const expired =
        authorization.tokenExpiresAt !== null &&
        authorization.tokenExpiresAt.getTime() <= Date.now();
      authorization.status = expired
        ? IntegrationStatus.EXPIRED
        : IntegrationStatus.REVOKED;
      authorization.accessTokenEncrypted = null;
      authorization.tokenExpiresAt = null;
      authorization.missingPermissions = authorization.scopes;
      authorization.lastError =
        debug.errorMessage ?? 'Meta reported that the authorization is no longer valid';
      await this.authorizations.save(authorization);
      await this.recordTokenEvent(
        authorization,
        expired ? IntegrationTokenEventType.EXPIRED : IntegrationTokenEventType.REVOKED,
        { errorCode: debug.errorCode },
      );

      const business = await this.businesses.findOne({
        where: { id: authorization.businessId },
      });
      await this.auditService.record({
        action: 'integration.reauthorization_required',
        actorUserId,
        tenantId: business?.tenantId ?? null,
        businessId: authorization.businessId,
        entityType: 'integration',
        entityId: authorization.id,
        metadata: { provider: PROVIDER, reason: expired ? 'expired' : 'revoked' },
        context: context ?? undefined,
      });
      return;
    }

    const previous = [...(authorization.grantedPermissions ?? [])].sort().join(',');
    const next = [...debug.scopes].sort().join(',');

    authorization.status = IntegrationStatus.ACTIVE;
    authorization.grantedPermissions = debug.scopes;
    authorization.missingPermissions = this.missingScopes(debug.scopes);
    authorization.tokenExpiresAt = debug.expiresAt ?? authorization.tokenExpiresAt;
    authorization.externalUserId = debug.userId ?? authorization.externalUserId;
    authorization.externalUserName =
      debug.userName ?? authorization.externalUserName;
    authorization.lastValidatedAt = new Date();
    authorization.lastError = null;
    await this.authorizations.save(authorization);

    await this.recordTokenEvent(
      authorization,
      IntegrationTokenEventType.VALIDATED,
    );

    if (previous !== next) {
      await this.recordTokenEvent(
        authorization,
        IntegrationTokenEventType.PERMISSIONS_CHANGED,
        { grantedPermissions: debug.scopes },
      );
    }

    const business = await this.businesses.findOne({
      where: { id: authorization.businessId },
    });
    await this.auditService.record({
      action: 'integration.validated',
      actorUserId,
      tenantId: business?.tenantId ?? null,
      businessId: authorization.businessId,
      entityType: 'integration',
      entityId: authorization.id,
      metadata: {
        provider: PROVIDER,
        grantedPermissions: debug.scopes,
        missingPermissions: authorization.missingPermissions,
      },
      context: context ?? undefined,
    });
  }

  private async persistAuthorization(input: {
    businessId: string;
    mode: IntegrationConnectionMode;
    token: string;
    tokenExpiresAt: Date | null;
    grantedPermissions: string[];
    externalUserId: string | null;
    externalUserName: string | null;
    authorizedByUserId: string;
    existing: IntegrationAuthorization | null;
  }): Promise<IntegrationAuthorization> {
    const authorization =
      input.existing ??
      this.authorizations.create({
        businessId: input.businessId,
        provider: PROVIDER,
      });

    authorization.connectionMode = input.mode;
    authorization.status = IntegrationStatus.ACTIVE;
    authorization.accessTokenEncrypted = this.cryptoService.encrypt(input.token);
    authorization.tokenKeyVersion = this.cryptoService.keyVersion;
    authorization.tokenExpiresAt = input.tokenExpiresAt;
    authorization.scopes = this.graphClient.getScopes();
    authorization.grantedPermissions = input.grantedPermissions;
    authorization.missingPermissions = this.missingScopes(input.grantedPermissions);
    authorization.externalUserId = input.externalUserId;
    authorization.externalUserName = input.externalUserName;
    authorization.authorizedByUserId = input.authorizedByUserId;
    authorization.lastValidatedAt = new Date();
    authorization.lastError = null;

    return this.authorizations.save(authorization);
  }

  private async tryDiscoverAssets(
    authorization: IntegrationAuthorization,
    actorUserId: string,
    context: RequestContext,
  ): Promise<void> {
    const token = this.decryptToken(authorization, false);

    if (!token) {
      return;
    }

    try {
      const discovery = await this.graphClient.discoverAssets(token);
      await this.syncAssets(authorization, discovery);
      await this.recordTokenEvent(
        authorization,
        IntegrationTokenEventType.DISCOVERED,
        { counts: this.assetCounts(discovery) },
      );
    } catch (caught) {
      // A token can be valid while asset fields are not granted; keep the
      // connection active and surface the problem on the health dashboard.
      const message = this.describeGraphFailure(caught);
      authorization.lastError = `Asset discovery failed: ${message}`;
      await this.authorizations.save(authorization);
      await this.recordTokenEvent(
        authorization,
        IntegrationTokenEventType.ERROR,
        { message },
      );
      this.logger.warn(
        `Asset discovery failed for integration ${authorization.id}: ${message}`,
      );
    }

    const business = await this.businesses.findOne({
      where: { id: authorization.businessId },
    });
    await this.auditService.record({
      action: 'integration.assets_discovered',
      actorUserId,
      tenantId: business?.tenantId ?? null,
      businessId: authorization.businessId,
      entityType: 'integration',
      entityId: authorization.id,
      metadata: { provider: PROVIDER },
      context,
    });
  }

  private async callDiscovery(token: string): Promise<MetaDiscoveryResult> {
    try {
      return await this.graphClient.discoverAssets(token);
    } catch (caught) {
      throw new BadGatewayException(this.describeGraphFailure(caught));
    }
  }

  private async syncAssets(
    authorization: IntegrationAuthorization,
    discovery: MetaDiscoveryResult,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(MetaInstagramAccount, {
        authorizationId: authorization.id,
      });
      await manager.delete(MetaPage, { authorizationId: authorization.id });
      await manager.delete(MetaAdAccount, { authorizationId: authorization.id });
      await manager.delete(MetaBusinessPortfolio, {
        authorizationId: authorization.id,
      });

      const uniquePortfolios = this.uniqueBy(
        discovery.portfolios,
        (entry) => entry.id,
      );
      const savedPortfolios = await manager.save(
        MetaBusinessPortfolio,
        uniquePortfolios.map((entry) =>
          manager.create(MetaBusinessPortfolio, {
            authorizationId: authorization.id,
            businessId: authorization.businessId,
            externalId: entry.id,
            name: entry.name,
            verificationStatus: entry.verificationStatus,
          }),
        ),
      );
      const portfolioIds = new Map(
        savedPortfolios.map((entry) => [entry.externalId, entry.id]),
      );

      const savedPages = await manager.save(
        MetaPage,
        this.uniqueBy(discovery.pages, (entry) => entry.id).map((entry) =>
          manager.create(MetaPage, {
            authorizationId: authorization.id,
            businessId: authorization.businessId,
            portfolioId: null,
            externalId: entry.id,
            name: entry.name,
            username: entry.username,
            category: entry.category,
            tasks: entry.tasks,
            instagramBusinessAccountId: entry.instagram?.id ?? null,
          }),
        ),
      );
      const pageIds = new Map(
        savedPages.map((entry) => [entry.externalId, entry.id]),
      );

      const instagram = this.uniqueBy(
        discovery.pages
          .filter((entry) => entry.instagram)
          .map((entry) => ({
            pageId: entry.id,
            instagram: entry.instagram!,
          })),
        (entry) => entry.instagram.id,
      );

      if (instagram.length > 0) {
        await manager.save(
          MetaInstagramAccount,
          instagram.map((entry) =>
            manager.create(MetaInstagramAccount, {
              authorizationId: authorization.id,
              businessId: authorization.businessId,
              pageId: pageIds.get(entry.pageId) ?? null,
              externalId: entry.instagram.id,
              username: entry.instagram.username ?? entry.instagram.id,
              name: entry.instagram.name,
            }),
          ),
        );
      }

      const accounts = this.uniqueBy(discovery.adAccounts, (entry) => entry.id);

      if (accounts.length > 0) {
        await manager.save(
          MetaAdAccount,
          accounts.map((entry) =>
            manager.create(MetaAdAccount, {
              authorizationId: authorization.id,
              businessId: authorization.businessId,
              portfolioId: entry.businessId
                ? portfolioIds.get(entry.businessId) ?? null
                : null,
              externalId: entry.id,
              name: entry.name,
              accountStatus: entry.accountStatus,
              currency: entry.currency,
              timezoneName: entry.timezoneName,
            }),
          ),
        );
      }
    });
  }

  private async deleteAssets(
    authorizationId: string,
    businessId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(MetaInstagramAccount, { authorizationId, businessId });
      await manager.delete(MetaPage, { authorizationId, businessId });
      await manager.delete(MetaAdAccount, { authorizationId, businessId });
      await manager.delete(MetaBusinessPortfolio, { authorizationId, businessId });
    });
  }

  private async loadAssets(
    businessId: string,
  ): Promise<MetaIntegrationOverview['assets']> {
    const [portfolios, pages, instagram, accounts] = await Promise.all([
      this.portfolios.find({ where: { businessId }, order: { name: 'ASC' } }),
      this.pages.find({ where: { businessId }, order: { name: 'ASC' } }),
      this.instagramAccounts.find({ where: { businessId }, order: { username: 'ASC' } }),
      this.adAccounts.find({ where: { businessId }, order: { name: 'ASC' } }),
    ]);

    return {
      businessPortfolios: portfolios.map((entry) => ({
        id: entry.id,
        externalId: entry.externalId,
        name: entry.name,
        detail: entry.verificationStatus,
        meta: { verificationStatus: entry.verificationStatus },
      })),
      pages: pages.map((entry) => ({
        id: entry.id,
        externalId: entry.externalId,
        name: entry.name,
        detail: entry.category,
        meta: {
          username: entry.username,
          tasks: entry.tasks ?? [],
          instagramBusinessAccountId: entry.instagramBusinessAccountId,
        },
      })),
      instagramAccounts: instagram.map((entry) => ({
        id: entry.id,
        externalId: entry.externalId,
        name: entry.name ?? entry.username,
        detail: `@${entry.username}`,
        meta: { username: entry.username, pageId: entry.pageId },
      })),
      adAccounts: accounts.map((entry) => ({
        id: entry.id,
        externalId: entry.externalId,
        name: entry.name,
        detail: entry.currency,
        meta: {
          accountStatus: entry.accountStatus,
          currency: entry.currency,
          timezoneName: entry.timezoneName,
        },
      })),
    };
  }

  private async findAuthorization(
    businessId: string,
  ): Promise<IntegrationAuthorization | null> {
    return this.authorizations.findOne({
      where: { businessId, provider: PROVIDER },
    });
  }

  private async requireAuthorization(
    businessId: string,
  ): Promise<IntegrationAuthorization> {
    const authorization = await this.findAuthorization(businessId);

    if (!authorization) {
      throw new NotFoundException('Meta is not connected to this business');
    }

    return authorization;
  }

  private decryptToken(
    authorization: IntegrationAuthorization,
    strict = true,
  ): string | null {
    if (!authorization.accessTokenEncrypted) {
      if (strict) {
        throw new BadRequestException(
          'Reconnect Meta before validating this integration',
        );
      }

      return null;
    }

    try {
      return this.cryptoService.decrypt(authorization.accessTokenEncrypted);
    } catch {
      if (strict) {
        throw new ServiceUnavailableException(
          'The stored Meta credential cannot be decrypted with the current key',
        );
      }

      return null;
    }
  }

  private toStatusView(
    authorization: IntegrationAuthorization | null,
  ): MetaIntegrationStatusView {
    if (!authorization) {
      return {
        connected: false,
        provider: PROVIDER,
        status: 'not_connected',
        connectionMode: null,
        externalUserId: null,
        externalUserName: null,
        tokenExpiresAt: null,
        lastValidatedAt: null,
        lastError: null,
        scopes: [],
        grantedPermissions: [],
        missingPermissions: [],
        requiresReauthorization: false,
        health: 'not_connected',
        authorizedByUserId: null,
        connectedAt: null,
      };
    }

    const expired =
      authorization.status === IntegrationStatus.EXPIRED ||
      (authorization.tokenExpiresAt !== null &&
        authorization.tokenExpiresAt.getTime() <= Date.now());

    const revoked =
      authorization.status === IntegrationStatus.REVOKED ||
      (authorization.status === IntegrationStatus.ACTIVE &&
        authorization.accessTokenEncrypted === null);

    const requiresReauthorization = expired || revoked;
    const missing = authorization.missingPermissions ?? [];

    let health: MetaIntegrationStatusView['health'] = 'healthy';

    if (revoked) {
      health = 'revoked';
    } else if (expired) {
      health = 'expired';
    } else if (authorization.status === IntegrationStatus.ERROR || missing.length > 0) {
      health = 'attention';
    }

    return {
      connected: authorization.status === IntegrationStatus.ACTIVE,
      provider: authorization.provider,
      status: authorization.status,
      connectionMode: authorization.connectionMode,
      externalUserId: authorization.externalUserId,
      externalUserName: authorization.externalUserName,
      tokenExpiresAt: authorization.tokenExpiresAt,
      lastValidatedAt: authorization.lastValidatedAt,
      lastError: authorization.lastError,
      scopes: authorization.scopes ?? [],
      grantedPermissions: authorization.grantedPermissions ?? [],
      missingPermissions: missing,
      requiresReauthorization,
      health,
      authorizedByUserId: authorization.authorizedByUserId,
      connectedAt: authorization.createdAt,
    };
  }

  private missingScopes(granted: string[]): string[] {
    const grantedSet = new Set(granted);
    return this.graphClient.getScopes().filter((scope) => !grantedSet.has(scope));
  }

  private async recordTokenEvent(
    authorization: IntegrationAuthorization,
    eventType: IntegrationTokenEventType,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.tokenEvents.insert({
      authorizationId: authorization.id,
      businessId: authorization.businessId,
      eventType,
      metadata: (metadata ?? null) as never,
    });
  }

  private assetCounts(discovery: MetaDiscoveryResult): Record<string, number> {
    return {
      businessPortfolios: discovery.portfolios.length,
      pages: discovery.pages.length,
      instagramAccounts: discovery.pages.filter((entry) => entry.instagram).length,
      adAccounts: discovery.adAccounts.length,
    };
  }

  private uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
    const seen = new Set<string>();

    return items.filter((item) => {
      const value = key(item);

      if (seen.has(value)) {
        return false;
      }

      seen.add(value);
      return true;
    });
  }

  private ensureConfigured(): void {
    if (!this.graphClient.isConfigured()) {
      throw new ServiceUnavailableException(
        'Meta integration is not configured on this deployment. Set META_APP_ID, META_APP_SECRET and META_REDIRECT_URI.',
      );
    }
  }

  private describeGraphFailure(caught: unknown): string {
    if (caught instanceof MetaGraphError) {
      return caught.message;
    }

    return caught instanceof Error ? caught.message : 'Meta Graph API request failed';
  }

  private successRedirect(path: string, result: string): string {
    return this.appendQuery(path, { meta: result });
  }

  private failureRedirect(path: string, reason: string): MetaOAuthCallbackResult {
    return {
      redirectUrl: this.appendQuery(path, { meta: 'error', reason }),
      connected: false,
    };
  }

  private appendQuery(path: string, params: Record<string, string>): string {
    const origin =
      this.configService.get<string>('frontendOrigin') ?? 'http://localhost:5173';
    const url = new URL(path.startsWith('/') ? path : '/', origin);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }
}
