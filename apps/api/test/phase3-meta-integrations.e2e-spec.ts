import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { AuditLog } from '../src/database/entities/audit-log.entity';
import { BusinessUser } from '../src/database/entities/business-user.entity';
import { Business } from '../src/database/entities/business.entity';
import { IntegrationAuthorization } from '../src/database/entities/integration-authorization.entity';
import { IntegrationTokenEvent } from '../src/database/entities/integration-token-event.entity';
import { MetaOAuthState } from '../src/database/entities/meta-oauth-state.entity';
import { Tenant } from '../src/database/entities/tenant.entity';
import { UserBusinessRole } from '../src/database/entities/user-business-role.entity';
import { User } from '../src/database/entities/user.entity';
import { MetaIntegrationsService } from '../src/modules/integrations/meta-integrations.service';
import {
  MetaDiscoveryResult,
  MetaGraphClient,
  MetaGraphError,
} from '../src/modules/integrations/meta-graph.client';

const API = '/api/v1';
const PASSWORD = 'Str0ngPassw0rd!';
const ACCESS_TOKEN = 'EAAG-phase3-secret-access-token';
const SYSTEM_USER_TOKEN = 'EAAG-phase3-system-user-token-value';

jest.setTimeout(30_000);

interface Session {
  userId: string;
  email: string;
  accessToken: string;
}

const defaultScopes = [
  'ads_management',
  'business_management',
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
  'leads_retrieval',
];

const defaultDiscovery: MetaDiscoveryResult = {
  portfolios: [
    { id: 'bp-100', name: 'Nimbus Holdings', verificationStatus: 'verified' },
  ],
  pages: [
    {
      id: 'page-200',
      name: 'Nimbus Coffee',
      username: 'nimbuscoffee',
      category: 'Coffee shop',
      tasks: ['MANAGE', 'ADVERTISE'],
      instagram: { id: 'ig-300', username: 'nimbus.coffee', name: 'Nimbus Coffee' },
    },
  ],
  adAccounts: [
    {
      id: 'act_400',
      name: 'Nimbus Ads',
      accountStatus: 1,
      currency: 'MYR',
      timezoneName: 'Asia/Kuala_Lumpur',
      businessId: 'bp-100',
    },
  ],
};

describe('Meta authentication and asset integration (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let integrations: MetaIntegrationsService;

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const ownerEmail = `phase3-owner-${suffix}@adpilot.test`;
  const outsiderEmail = `phase3-outsider-${suffix}@adpilot.test`;

  const userIds: string[] = [];
  const businessIds: string[] = [];
  const tenantIds: string[] = [];

  let owner: Session;
  let outsider: Session;
  let businessId: string;
  let systemUserBusinessId: string;

  const metaState = {
    configured: true,
    debugValid: true,
    scopes: [...defaultScopes],
    discovery: defaultDiscovery,
    exchangeFails: false,
    revokeCalls: 0,
  };

  const graphMock = {
    isConfigured: () => metaState.configured,
    getScopes: () => defaultScopes,
    buildAuthorizationUrl: (state: string) => {
      const url = new URL('https://www.facebook.com/v23.0/dialog/oauth');
      url.searchParams.set('client_id', 'test-app-id');
      url.searchParams.set('state', state);
      url.searchParams.set('scope', defaultScopes.join(','));
      return url.toString();
    },
    exchangeCodeForToken: async () => {
      if (metaState.exchangeFails) {
        throw new MetaGraphError('Invalid verification code', 400, 100);
      }

      return {
        accessToken: ACCESS_TOKEN,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      };
    },
    debugToken: async () => ({
      isValid: metaState.debugValid,
      appId: 'test-app-id',
      userId: 'meta-user-1',
      userName: 'Meta Tester',
      scopes: [...metaState.scopes],
      expiresAt: metaState.debugValid
        ? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
        : null,
      errorCode: metaState.debugValid ? null : 190,
      errorMessage: metaState.debugValid ? null : 'Session has expired',
    }),
    discoverAssets: async () => metaState.discovery,
    revokePermissions: async () => {
      metaState.revokeCalls += 1;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MetaGraphClient)
      .useValue(graphMock)
      .compile();

    app = moduleFixture.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();

    dataSource = app.get(DataSource);
    integrations = app.get(MetaIntegrationsService);

    owner = await register(ownerEmail, 'Owen', 'Owner');
    outsider = await register(outsiderEmail, 'Olive', 'Outsider');

    businessId = await createBusiness('Phase Three Coffee');
    systemUserBusinessId = await createBusiness('Phase Three System User');
  });

  afterAll(async () => {
    if (businessIds.length > 0) {
      await dataSource.getRepository(AuditLog).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(UserBusinessRole).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(BusinessUser).delete({ businessId: In(businessIds) });
    }

    if (userIds.length > 0) {
      await dataSource.getRepository(User).delete({ id: In(userIds) });
    }

    if (businessIds.length > 0) {
      await dataSource.getRepository(Business).delete({ id: In(businessIds) });
    }

    if (tenantIds.length > 0) {
      await dataSource.getRepository(Tenant).delete({ id: In(tenantIds) });
    }

    await app.close();
  });

  const bearer = (session: Session) => `Bearer ${session.accessToken}`;

  async function register(
    email: string,
    firstName: string,
    lastName: string,
  ): Promise<Session> {
    const response = await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({ email, password: PASSWORD, firstName, lastName })
      .expect(201);

    userIds.push(response.body.user.id);

    return {
      userId: response.body.user.id,
      email,
      accessToken: response.body.accessToken,
    };
  }

  async function createBusiness(name: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`${API}/businesses`)
      .set('Authorization', bearer(owner))
      .send({ name, currency: 'MYR', timezone: 'Asia/Kuala_Lumpur' })
      .expect(201);

    const id = response.body.business.id as string;
    businessIds.push(id);
    tenantIds.push(response.body.business.tenantId as string);

    return id;
  }

  async function startOAuth(targetBusinessId = businessId): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`${API}/businesses/${targetBusinessId}/integrations/meta/oauth/start`)
      .set('Authorization', bearer(owner))
      .send({ redirectPath: `/businesses/${targetBusinessId}` })
      .expect(201);

    const url = new URL(response.body.authorizationUrl as string);
    const state = url.searchParams.get('state');

    expect(state).toBeTruthy();
    expect(url.searchParams.get('client_id')).toBe('test-app-id');

    return state as string;
  }

  function completeOAuth(
    state: string,
    code = 'test-code',
  ): request.Test {
    return request(app.getHttpServer()).get(
      `${API}/integrations/meta/oauth/callback?code=${code}&state=${state}`,
    );
  }

  beforeEach(() => {
    metaState.configured = true;
    metaState.debugValid = true;
    metaState.scopes = [...defaultScopes];
    metaState.discovery = defaultDiscovery;
    metaState.exchangeFails = false;
    metaState.revokeCalls = 0;
  });

  it('reports a business as not connected before authorization', async () => {
    const response = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/integrations/meta`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(response.body.authorization).toMatchObject({
      connected: false,
      status: 'not_connected',
      health: 'not_connected',
      requiresReauthorization: false,
    });
    expect(response.body.assets.businessPortfolios).toHaveLength(0);
  });

  it('creates a hashed, expiring OAuth state instead of storing it raw', async () => {
    const state = await startOAuth();

    const stored = await dataSource
      .getRepository(MetaOAuthState)
      .findOne({ where: { businessId } });

    expect(stored).not.toBeNull();
    expect(stored?.stateHash).not.toBe(state);
    expect(stored?.stateHash).toHaveLength(64);
    expect(stored?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(stored?.consumedAt).toBeNull();
  });

  it('exchanges the callback code, encrypts the token and links discovered assets', async () => {
    const state = await startOAuth();
    const callback = await completeOAuth(state).expect(302);

    expect(callback.headers.location).toContain('meta=connected');
    expect(callback.headers.location).toContain(`/businesses/${businessId}`);

    const authorization = await dataSource
      .getRepository(IntegrationAuthorization)
      .findOne({ where: { businessId } });

    expect(authorization).not.toBeNull();
    expect(authorization?.status).toBe('active');
    expect(authorization?.connectionMode).toBe('client_oauth');
    expect(authorization?.accessTokenEncrypted).not.toBe(ACCESS_TOKEN);
    expect(authorization?.accessTokenEncrypted?.startsWith('v1:')).toBe(true);
    expect(authorization?.grantedPermissions).toEqual(defaultScopes);
    expect(authorization?.missingPermissions).toEqual([]);

    const response = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/integrations/meta`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(response.body.authorization).toMatchObject({
      connected: true,
      status: 'active',
      connectionMode: 'client_oauth',
      health: 'healthy',
      requiresReauthorization: false,
      externalUserId: 'meta-user-1',
    });
    expect(response.body.authorization.tokenExpiresAt).toBeTruthy();

    expect(response.body.assets.businessPortfolios).toHaveLength(1);
    expect(response.body.assets.pages).toHaveLength(1);
    expect(response.body.assets.instagramAccounts).toHaveLength(1);
    expect(response.body.assets.adAccounts).toHaveLength(1);
    expect(response.body.assets.adAccounts[0]).toMatchObject({
      externalId: 'act_400',
      name: 'Nimbus Ads',
    });
    expect(response.body.assets.pages[0]).toMatchObject({
      externalId: 'page-200',
      name: 'Nimbus Coffee',
    });
    expect(response.body.assets.instagramAccounts[0]).toMatchObject({
      externalId: 'ig-300',
      detail: '@nimbus.coffee',
    });

    // The API response must never leak the credential or its ciphertext.
    expect(JSON.stringify(response.body)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(response.body)).not.toContain(
      authorization?.accessTokenEncrypted,
    );

    const events = await dataSource
      .getRepository(IntegrationTokenEvent)
      .find({ where: { businessId } });

    expect(events.some((event) => event.eventType === 'authorized')).toBe(true);
    expect(events.some((event) => event.eventType === 'discovered')).toBe(true);
  });

  it('rejects a replayed OAuth state', async () => {
    const state = await startOAuth();
    await completeOAuth(state).expect(302);

    const replay = await completeOAuth(state).expect(302);

    expect(replay.headers.location).toContain('meta=error');
    expect(replay.headers.location).toContain('reason=state_expired');
  });

  it('does not expose another business integration state', async () => {
    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/integrations/meta`)
      .set('Authorization', bearer(outsider))
      .expect(404);

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/integrations/meta/oauth/start`)
      .set('Authorization', bearer(outsider))
      .send({})
      .expect(404);

    // Assets are scoped to the business that authorized them.
    const other = await request(app.getHttpServer())
      .get(`${API}/businesses/${systemUserBusinessId}/integrations/meta`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(other.body.authorization.status).toBe('not_connected');
    expect(other.body.assets.pages).toHaveLength(0);
  });

  it('tracks revoked permissions and restores health after reauthorization', async () => {
    metaState.scopes = defaultScopes.filter(
      (scope) => scope !== 'leads_retrieval',
    );

    const degraded = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/integrations/meta/validate`)
      .set('Authorization', bearer(owner))
      .expect(201);

    expect(degraded.body.authorization.health).toBe('attention');
    expect(degraded.body.authorization.missingPermissions).toContain(
      'leads_retrieval',
    );
    expect(degraded.body.authorization.connected).toBe(true);

    metaState.scopes = [...defaultScopes];

    const restored = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/integrations/meta/validate`)
      .set('Authorization', bearer(owner))
      .expect(201);

    expect(restored.body.authorization.health).toBe('healthy');
    expect(restored.body.authorization.missingPermissions).toEqual([]);

    const events = await dataSource
      .getRepository(IntegrationTokenEvent)
      .find({ where: { businessId } });

    expect(
      events.some((event) => event.eventType === 'permissions_changed'),
    ).toBe(true);
  });

  it('detects a revoked Meta authorization and requires reauthorization', async () => {
    metaState.debugValid = false;

    const response = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/integrations/meta/validate`)
      .set('Authorization', bearer(owner))
      .expect(201);

    expect(response.body.authorization).toMatchObject({
      connected: false,
      status: 'revoked',
      health: 'revoked',
      requiresReauthorization: true,
    });
    expect(response.body.authorization.missingPermissions).toEqual(defaultScopes);

    const authorization = await dataSource
      .getRepository(IntegrationAuthorization)
      .findOne({ where: { businessId } });

    expect(authorization?.accessTokenEncrypted).toBeNull();
    expect(authorization?.tokenExpiresAt).toBeNull();

    const audits = await dataSource
      .getRepository(AuditLog)
      .find({ where: { businessId } });

    expect(
      audits.some(
        (entry) => entry.action === 'integration.reauthorization_required',
      ),
    ).toBe(true);
  });

  it('reauthorizes a revoked connection through the OAuth flow', async () => {
    const state = await startOAuth();
    await completeOAuth(state).expect(302);

    const response = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/integrations/meta`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(response.body.authorization).toMatchObject({
      connected: true,
      status: 'active',
      health: 'healthy',
      requiresReauthorization: false,
    });
    expect(response.body.assets.adAccounts).toHaveLength(1);

    const events = await dataSource
      .getRepository(IntegrationTokenEvent)
      .find({ where: { businessId } });

    expect(events.some((event) => event.eventType === 'reauthorized')).toBe(true);
  });

  it('supports System User token intake without exposing the credential', async () => {
    const response = await request(app.getHttpServer())
      .post(`${API}/businesses/${systemUserBusinessId}/integrations/meta/system-user`)
      .set('Authorization', bearer(owner))
      .send({ accessToken: SYSTEM_USER_TOKEN })
      .expect(201);

    expect(response.body.authorization).toMatchObject({
      connected: true,
      status: 'active',
      connectionMode: 'system_user',
      health: 'healthy',
    });
    expect(response.body.assets.pages).toHaveLength(1);
    expect(JSON.stringify(response.body)).not.toContain(SYSTEM_USER_TOKEN);

    const authorization = await dataSource
      .getRepository(IntegrationAuthorization)
      .findOne({ where: { businessId: systemUserBusinessId } });

    expect(authorization?.connectionMode).toBe('system_user');
    expect(authorization?.accessTokenEncrypted).not.toBe(SYSTEM_USER_TOKEN);
    expect(authorization?.accessTokenEncrypted?.startsWith('v1:')).toBe(true);
  });

  it('keeps the monitor sweep foundation working for expiring tokens', async () => {
    const repository = dataSource.getRepository(IntegrationAuthorization);
    await repository.update(
      { businessId },
      {
        tokenExpiresAt: new Date(Date.now() - 60_000),
        lastValidatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    );

    const refreshed = await integrations.monitorSweep();
    expect(refreshed.checked).toBeGreaterThanOrEqual(1);
    expect(refreshed.revoked).toBe(0);

    metaState.debugValid = false;
    await repository.update(
      { businessId },
      {
        tokenExpiresAt: new Date(Date.now() - 60_000),
        lastValidatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    );

    const revoked = await integrations.monitorSweep();
    expect(revoked.checked).toBeGreaterThanOrEqual(1);
    expect(revoked.revoked).toBeGreaterThanOrEqual(1);
  });

  it('disconnects, clears credentials and removes discovered assets', async () => {
    // Restore a fresh credential first; the monitor test revoked it.
    const state = await startOAuth();
    await completeOAuth(state).expect(302);

    const response = await request(app.getHttpServer())
      .delete(`${API}/businesses/${businessId}/integrations/meta`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(response.body.authorization).toMatchObject({
      connected: false,
      status: 'revoked',
      requiresReauthorization: true,
    });
    expect(response.body.assets.pages).toHaveLength(0);
    expect(response.body.assets.adAccounts).toHaveLength(0);
    expect(metaState.revokeCalls).toBeGreaterThanOrEqual(1);

    const authorization = await dataSource
      .getRepository(IntegrationAuthorization)
      .findOne({ where: { businessId } });

    expect(authorization?.accessTokenEncrypted).toBeNull();
  });

  it('requires integration management permission to change the connection', async () => {
    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/integrations/meta/oauth/start`)
      .send({})
      .expect(401);

    await request(app.getHttpServer())
      .post(`${API}/integrations/meta/monitor/sweep`)
      .set('Authorization', bearer(owner))
      .expect(403);
  });
});
