import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { rm } from 'fs/promises';
import { join } from 'path';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { AdvertisingObjective } from '../src/common/enums/advertising-objective.enum';
import { AdvertisingStatus } from '../src/common/enums/advertising-status.enum';
import { BillingEvent } from '../src/common/enums/billing-event.enum';
import { IntegrationConnectionMode } from '../src/common/enums/integration-connection-mode.enum';
import { IntegrationStatus } from '../src/common/enums/integration-status.enum';
import { OptimizationGoal } from '../src/common/enums/optimization-goal.enum';
import { AdSet } from '../src/database/entities/ad-set.entity';
import { Advertisement } from '../src/database/entities/advertisement.entity';
import { AdvertisingAsset } from '../src/database/entities/advertising-asset.entity';
import { AuditLog } from '../src/database/entities/audit-log.entity';
import { BusinessUser } from '../src/database/entities/business-user.entity';
import { Business } from '../src/database/entities/business.entity';
import { CampaignStatusHistory } from '../src/database/entities/campaign-status-history.entity';
import { Campaign } from '../src/database/entities/campaign.entity';
import { Creative } from '../src/database/entities/creative.entity';
import { IntegrationAuthorization } from '../src/database/entities/integration-authorization.entity';
import { MetaAdAccount } from '../src/database/entities/meta-ad-account.entity';
import { MetaPage } from '../src/database/entities/meta-page.entity';
import { MetaReviewStatusHistory } from '../src/database/entities/meta-review-status-history.entity';
import { PlatformSyncLog } from '../src/database/entities/platform-sync-log.entity';
import { Tenant } from '../src/database/entities/tenant.entity';
import { UserBusinessRole } from '../src/database/entities/user-business-role.entity';
import { User } from '../src/database/entities/user.entity';
import { CampaignPublishingService } from '../src/modules/advertising/campaign-publishing.service';
import { CampaignQueueService } from '../src/modules/advertising/campaign-queue.service';
import { IntegrationCryptoService } from '../src/modules/integrations/integration-crypto.service';
import { MetaGraphClient, MetaGraphError } from '../src/modules/integrations/meta-graph.client';

const API = '/api/v1';
const PASSWORD = 'Str0ngPassw0rd!';
const ACCESS_TOKEN = 'EAAG-phase5-secret-access-token';
const ACCOUNT_ID = 'act-phase5-100';
const PAGE_ID = 'page-phase5-200';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

jest.setTimeout(60_000);

interface Session {
  userId: string;
  email: string;
  accessToken: string;
}

interface MetaStatusFixture {
  status?: string | null;
  effectiveStatus?: string | null;
  issues?: Array<{ code: number | null; summary: string | null }>;
}

describe('Campaign and advertisement management (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let publishing: CampaignPublishingService;
  let adAccountId: string;
  let pageId: string;

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const ownerEmail = `phase5-owner-${suffix}@adpilot.test`;
  const viewerEmail = `phase5-viewer-${suffix}@adpilot.test`;
  const strangerEmail = `phase5-stranger-${suffix}@adpilot.test`;

  const userIds: string[] = [];
  const businessIds: string[] = [];
  const tenantIds: string[] = [];

  let owner: Session;
  let viewer: Session;
  let stranger: Session;
  let businessId: string;

  let assetId = '';
  let creativeId = '';
  let campaignBId = '';
  let campaignBExternalId = '';
  let adBExternalId = '';

  const graphState = {
    campaignSeq: 0,
    adSetSeq: 0,
    adSeq: 0,
    creativeSeq: 0,
    imageUploads: 0,
    failOn: null as 'campaign' | 'ad_set' | 'ad' | 'creative' | 'update' | null,
    statuses: new Map<string, MetaStatusFixture>(),
    updates: [] as Array<{ externalId: string; status: unknown }>,
    tokens: [] as string[],
  };

  const graphMock = {
    createCampaign: async (
      token: string,
      _account: string,
      params: { status?: string },
    ): Promise<{ id: string }> => {
      graphState.tokens.push(token);

      if (graphState.failOn === 'campaign') {
        throw new MetaGraphError('Meta campaign service unavailable', 500, 1);
      }

      graphState.campaignSeq += 1;
      const id = `meta-campaign-${suffix}-${graphState.campaignSeq}`;
      graphState.statuses.set(id, {
        status: String(params.status ?? 'PAUSED'),
        effectiveStatus: 'ACTIVE',
      });

      return { id };
    },
    createAdSet: async (): Promise<{ id: string }> => {
      if (graphState.failOn === 'ad_set') {
        throw new MetaGraphError('Meta ad set rejected', 400, 100);
      }

      graphState.adSetSeq += 1;
      const id = `meta-adset-${suffix}-${graphState.adSetSeq}`;
      graphState.statuses.set(id, { status: 'PAUSED', effectiveStatus: 'ACTIVE' });

      return { id };
    },
    createAd: async (): Promise<{ id: string }> => {
      if (graphState.failOn === 'ad') {
        throw new MetaGraphError('Meta ad creation failed', 500, 1);
      }

      graphState.adSeq += 1;
      const id = `meta-ad-${suffix}-${graphState.adSeq}`;
      graphState.statuses.set(id, { status: 'PAUSED', effectiveStatus: 'PENDING_REVIEW' });

      return { id };
    },
    createCreative: async (): Promise<{ id: string }> => {
      if (graphState.failOn === 'creative') {
        throw new MetaGraphError('Meta creative rejected', 400, 100);
      }

      graphState.creativeSeq += 1;

      return { id: `meta-creative-${suffix}-${graphState.creativeSeq}` };
    },
    updateAdvertisingEntity: async (
      _token: string,
      externalId: string,
      fields: Record<string, string | number>,
    ): Promise<void> => {
      if (graphState.failOn === 'update') {
        throw new MetaGraphError('Meta rejected the update', 400, 100);
      }

      graphState.updates.push({ externalId, status: fields.status });
    },
    getAdvertisingStatus: async (
      _token: string,
      externalId: string,
    ): Promise<{
      id: string;
      status: string | null;
      effectiveStatus: string | null;
      issues: Array<{ code: number | null; summary: string | null }>;
    }> => {
      const fixture = graphState.statuses.get(externalId) ?? {
        status: 'ACTIVE',
        effectiveStatus: 'ACTIVE',
      };

      return {
        id: externalId,
        status: fixture.status ?? null,
        effectiveStatus: fixture.effectiveStatus ?? null,
        issues: fixture.issues ?? [],
      };
    },
    getCampaignSpend: async (): Promise<{
      spend: number | null;
      currency: string | null;
      dateStart: string | null;
      dateStop: string | null;
    }> => ({ spend: null, currency: null, dateStart: null, dateStop: null }),
    uploadAdImage: async (): Promise<{ hash: string; url: string | null }> => {
      graphState.imageUploads += 1;

      return { hash: `meta-image-hash-${graphState.imageUploads}`, url: null };
    },
  };

  // Publishing runs through the real worker logic, but synchronously so the
  // suite never races the BullMQ worker.
  const queueMock = {
    enqueuePublish: async (job: Parameters<CampaignQueueService['enqueuePublish']>[0]) => {
      await publishing.publishCampaign(job);
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MetaGraphClient)
      .useValue(graphMock)
      .overrideProvider(CampaignQueueService)
      .useValue(queueMock)
      .compile();

    app = moduleFixture.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();

    dataSource = app.get(DataSource);
    publishing = app.get(CampaignPublishingService);

    owner = await register(ownerEmail, 'Olivia', 'Owner');
    viewer = await register(viewerEmail, 'Vera', 'Viewer');
    stranger = await register(strangerEmail, 'Sam', 'Stranger');
    businessId = await createBusiness('Phase Five Advertising');

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/members`)
      .set('Authorization', bearer(owner))
      .send({ email: viewerEmail, roleKey: 'business_viewer' })
      .expect(201);

    const crypto = app.get(IntegrationCryptoService);
    const authorizationRepo = dataSource.getRepository(IntegrationAuthorization);
    const authorization = await authorizationRepo.save(
      authorizationRepo.create({
        businessId,
        provider: 'meta',
        connectionMode: IntegrationConnectionMode.CLIENT_OAUTH,
        status: IntegrationStatus.ACTIVE,
        accessTokenEncrypted: crypto.encrypt(ACCESS_TOKEN),
        scopes: ['ads_management'],
        grantedPermissions: ['ads_management'],
        missingPermissions: [],
        tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    );

    const adAccountRepo = dataSource.getRepository(MetaAdAccount);
    const account = await adAccountRepo.save(
      adAccountRepo.create({
        authorizationId: authorization.id,
        businessId,
        externalId: ACCOUNT_ID,
        name: 'Phase Five Ad Account',
        accountStatus: 1,
        currency: 'MYR',
        timezoneName: 'Asia/Kuala_Lumpur',
      }),
    );
    adAccountId = account.id;

    const pageRepo = dataSource.getRepository(MetaPage);
    const page = await pageRepo.save(
      pageRepo.create({
        authorizationId: authorization.id,
        businessId,
        externalId: PAGE_ID,
        name: 'Phase Five Page',
        tasks: ['MANAGE'],
      }),
    );
    pageId = page.id;

    const upload = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/assets`)
      .set('Authorization', bearer(owner))
      .attach('file', PNG, { filename: 'pixel.png', contentType: 'image/png' })
      .expect(201);
    assetId = upload.body.id;

    const creative = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/creatives`)
      .set('Authorization', bearer(owner))
      .send({
        name: 'Phase Five creative',
        pageId,
        assetId,
        headline: 'Try AdPilot',
        primaryText: 'Campaigns built in minutes',
        description: 'Phase five creative',
        callToAction: 'LEARN_MORE',
        destinationUrl: 'https://example.com/phase-five',
      })
      .expect(201);
    creativeId = creative.body.id;

    const full = await createFullCampaign('Phase Five Launch');
    campaignBId = full.campaign.id;
  });

  afterAll(async () => {
    if (businessIds.length > 0) {
      await dataSource
        .getRepository(PlatformSyncLog)
        .delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(MetaReviewStatusHistory)
        .delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(CampaignStatusHistory)
        .delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(Advertisement)
        .delete({ businessId: In(businessIds) });
      await dataSource.getRepository(AdSet).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(Campaign).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(Creative).delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(AdvertisingAsset)
        .delete({ businessId: In(businessIds) });
      await dataSource.getRepository(AuditLog).delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(UserBusinessRole)
        .delete({ businessId: In(businessIds) });
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

    if (businessIds.length > 0) {
      await rm(join(process.cwd(), 'var/test-uploads', businessId), {
        recursive: true,
        force: true,
      });
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

  async function createCampaign(name: string): Promise<Record<string, any>> {
    const response = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/campaigns`)
      .set('Authorization', bearer(owner))
      .send({
        name,
        objective: AdvertisingObjective.TRAFFIC,
        adAccountId,
        dailyBudget: 50,
        specialAdCategories: [],
      })
      .expect(201);

    return response.body;
  }

  async function createFullCampaign(
    name: string,
  ): Promise<{
    campaign: Record<string, any>;
    adSet: Record<string, any>;
    advertisement: Record<string, any>;
  }> {
    const campaign = await createCampaign(name);
    const adSetResponse = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/campaigns/${campaign.id}/ad-sets`)
      .set('Authorization', bearer(owner))
      .send({
        name: `${name} ad set`,
        optimizationGoal: OptimizationGoal.LINK_CLICKS,
        billingEvent: BillingEvent.IMPRESSIONS,
        targeting: { geo_locations: { countries: ['MY'] } },
        dailyBudget: 20,
        startTime: '2026-12-01T00:00:00.000Z',
      })
      .expect(201);

    const advertisementResponse = await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/ad-sets/${adSetResponse.body.id}/advertisements`,
      )
      .set('Authorization', bearer(owner))
      .send({ name: `${name} advertisement`, creativeId })
      .expect(201);

    return {
      campaign,
      adSet: adSetResponse.body,
      advertisement: advertisementResponse.body,
    };
  }

  it('enforces authentication and tenant isolation', async () => {
    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/campaigns`)
      .expect(401);

    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/campaigns`)
      .set('Authorization', bearer(stranger))
      .expect(404);

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/campaigns`)
      .set('Authorization', bearer(stranger))
      .send({ name: 'Intruder', objective: AdvertisingObjective.TRAFFIC, adAccountId })
      .expect(404);
  });

  it('lets a viewer read campaigns but not change them', async () => {
    const list = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/campaigns`)
      .set('Authorization', bearer(viewer))
      .expect(200);

    expect(list.body.items.length).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/campaigns`)
      .set('Authorization', bearer(viewer))
      .send({ name: 'Viewer campaign', objective: AdvertisingObjective.TRAFFIC, adAccountId })
      .expect(403);

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/campaigns/${campaignBId}/publish`)
      .set('Authorization', bearer(viewer))
      .send({})
      .expect(403);

    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/campaigns/${campaignBId}`)
      .set('Authorization', bearer(viewer))
      .expect(200);
  });

  it('creates, updates and deletes draft campaigns and their structure', async () => {
    const campaign = await createCampaign('Draft to edit');
    expect(campaign.status).toBe(AdvertisingStatus.DRAFT);
    expect(campaign.adAccountExternalId).toBe(ACCOUNT_ID);
    expect(campaign.dailyBudget).toBe(50);

    const updated = await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/campaigns/${campaign.id}`)
      .set('Authorization', bearer(owner))
      .send({ name: 'Draft renamed', lifetimeBudget: 200 })
      .expect(200);

    expect(updated.body.name).toBe('Draft renamed');
    expect(updated.body.lifetimeBudget).toBe(200);

    const adSet = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/campaigns/${campaign.id}/ad-sets`)
      .set('Authorization', bearer(owner))
      .send({
        name: 'Draft ad set',
        optimizationGoal: OptimizationGoal.REACH,
        billingEvent: BillingEvent.IMPRESSIONS,
        targeting: { geo_locations: { countries: ['MY'] } },
      })
      .expect(201);

    const updatedAdSet = await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/ad-sets/${adSet.body.id}`)
      .set('Authorization', bearer(owner))
      .send({ name: 'Draft ad set renamed' })
      .expect(200);

    expect(updatedAdSet.body.name).toBe('Draft ad set renamed');

    const advertisement = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/ad-sets/${adSet.body.id}/advertisements`)
      .set('Authorization', bearer(owner))
      .send({ name: 'Draft advertisement', creativeId })
      .expect(201);

    const deletedAd = await request(app.getHttpServer())
      .delete(`${API}/businesses/${businessId}/advertisements/${advertisement.body.id}`)
      .set('Authorization', bearer(owner))
      .expect(204);
    expect(deletedAd.body).toEqual({});

    await request(app.getHttpServer())
      .delete(`${API}/businesses/${businessId}/ad-sets/${adSet.body.id}`)
      .set('Authorization', bearer(owner))
      .expect(204);

    const draftOnly = await createCampaign('Draft to delete');
    await request(app.getHttpServer())
      .delete(`${API}/businesses/${businessId}/campaigns/${draftOnly.id}`)
      .set('Authorization', bearer(owner))
      .expect(204);

    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/campaigns/${draftOnly.id}`)
      .set('Authorization', bearer(owner))
      .expect(404);
  });

  it('validates and serves uploaded media', async () => {
    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/assets`)
      .set('Authorization', bearer(owner))
      .attach('file', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    const content = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/assets/${assetId}/content`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(content.headers['content-type']).toBe('image/png');
    expect(Buffer.from(content.body).length).toBe(PNG.length);

    const list = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/assets`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id: assetId, status: 'uploaded' });

    const second = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/assets`)
      .set('Authorization', bearer(owner))
      .attach('file', PNG, { filename: 'second.png', contentType: 'image/png' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`${API}/businesses/${businessId}/assets/${second.body.id}`)
      .set('Authorization', bearer(owner))
      .expect(204);
  });

  it('manages creatives and refuses to delete a creative that is in use', async () => {
    const creative = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/creatives`)
      .set('Authorization', bearer(owner))
      .send({
        name: 'Alternate creative',
        pageId,
        headline: 'Alternate',
        primaryText: 'Alternate copy',
        destinationUrl: 'https://example.com/alternate',
      })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/creatives/${creative.body.id}`)
      .set('Authorization', bearer(owner))
      .send({ headline: 'Alternate v2' })
      .expect(200);

    expect(updated.body.headline).toBe('Alternate v2');

    await request(app.getHttpServer())
      .delete(`${API}/businesses/${businessId}/creatives/${creativeId}`)
      .set('Authorization', bearer(owner))
      .expect(400);

    await request(app.getHttpServer())
      .delete(`${API}/businesses/${businessId}/creatives/${creative.body.id}`)
      .set('Authorization', bearer(owner))
      .expect(204);
  });

  it('publishes a campaign and stores Meta identifiers', async () => {
    const response = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/campaigns/${campaignBId}/publish`)
      .set('Authorization', bearer(owner))
      .send({ activate: true })
      .expect(202);

    expect(response.body.status).toBe(AdvertisingStatus.ACTIVE);
    expect(response.body.externalId).toBeTruthy();
    expect(response.body.publishedAt).toBeTruthy();
    expect(response.body.metaReviewStatus).toBe('approved');
    expect(response.body.adSets[0].externalId).toBeTruthy();
    expect(response.body.adSets[0].advertisements[0].externalId).toBeTruthy();

    campaignBExternalId = response.body.externalId;
    adBExternalId = response.body.adSets[0].advertisements[0].externalId;

    expect(graphState.tokens).toContain(ACCESS_TOKEN);
    expect(graphState.tokens).not.toContain('null');
    expect(graphState.imageUploads).toBeGreaterThanOrEqual(1);

    const stored = await dataSource
      .getRepository(Campaign)
      .findOneOrFail({ where: { id: campaignBId } });
    expect(stored.externalId).toBe(campaignBExternalId);
    expect(stored.publishedAt).toBeTruthy();
    expect(stored.status).toBe(AdvertisingStatus.ACTIVE);

    const storedAd = await dataSource
      .getRepository(Advertisement)
      .findOneOrFail({ where: { externalId: adBExternalId } });
    expect(storedAd.externalId).toBe(adBExternalId);
  });

  it('blocks edits and deletes on a published campaign', async () => {
    await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/campaigns/${campaignBId}`)
      .set('Authorization', bearer(owner))
      .send({ name: 'Cannot change' })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`${API}/businesses/${businessId}/campaigns/${campaignBId}`)
      .set('Authorization', bearer(owner))
      .expect(400);
  });

  it('pushes campaign status changes to Meta before updating locally', async () => {
    const paused = await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/campaigns/${campaignBId}/status`)
      .set('Authorization', bearer(owner))
      .send({ status: 'paused' })
      .expect(200);

    expect(paused.body.status).toBe(AdvertisingStatus.PAUSED);
    expect(graphState.updates).toEqual([
      { externalId: campaignBExternalId, status: 'PAUSED' },
    ]);

    graphState.failOn = 'update';
    await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/campaigns/${campaignBId}/status`)
      .set('Authorization', bearer(owner))
      .send({ status: 'active' })
      .expect(502);
    graphState.failOn = null;

    const stored = await dataSource
      .getRepository(Campaign)
      .findOneOrFail({ where: { id: campaignBId } });
    expect(stored.status).toBe(AdvertisingStatus.PAUSED);

    const resumed = await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/campaigns/${campaignBId}/status`)
      .set('Authorization', bearer(owner))
      .send({ status: 'active' })
      .expect(200);
    expect(resumed.body.status).toBe(AdvertisingStatus.ACTIVE);
  });

  it('does not mark a campaign published when Meta rejects a child record', async () => {
    const full = await createFullCampaign('Phase Five Failure');
    graphState.failOn = 'ad';

    const failed = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/campaigns/${full.campaign.id}/publish`)
      .set('Authorization', bearer(owner))
      .send({ activate: true })
      .expect(202);

    expect(failed.body.status).toBe(AdvertisingStatus.ERROR);
    expect(failed.body.publishedAt).toBeNull();
    expect(failed.body.lastError).toContain('Meta ad creation failed');
    expect(failed.body.externalId).toBeTruthy();
    expect(failed.body.adSets[0].externalId).toBeTruthy();
    expect(failed.body.adSets[0].advertisements[0].externalId).toBeNull();

    const campaignExternalId = failed.body.externalId as string;
    graphState.failOn = null;

    const resumed = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/campaigns/${full.campaign.id}/publish`)
      .set('Authorization', bearer(owner))
      .send({ activate: false })
      .expect(202);

    expect(resumed.body.status).toBe(AdvertisingStatus.PAUSED);
    expect(resumed.body.publishedAt).toBeTruthy();
    expect(resumed.body.externalId).toBe(campaignExternalId);
    expect(resumed.body.adSets[0].advertisements[0].externalId).toBeTruthy();

    const adSetCount = await dataSource
      .getRepository(AdSet)
      .count({ where: { campaignId: full.campaign.id } });
    expect(adSetCount).toBe(1);
  });

  it('synchronises Meta review state and records its history', async () => {
    graphState.statuses.set(campaignBExternalId, {
      status: 'ACTIVE',
      effectiveStatus: 'PENDING_REVIEW',
    });
    graphState.statuses.set(adBExternalId, {
      status: 'ACTIVE',
      effectiveStatus: 'DISAPPROVED',
      issues: [{ code: 1, summary: 'Ad text violates advertising policies' }],
    });

    const inReview = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/campaigns/${campaignBId}/sync`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(inReview.body.metaReviewStatus).toBe('in_review');
    expect(inReview.body.externalStatus).toBe('PENDING_REVIEW');
    expect(inReview.body.adSets[0].advertisements[0].metaReviewStatus).toBe('rejected');
    expect(inReview.body.reviewHistory.length).toBeGreaterThan(0);

    graphState.statuses.set(campaignBExternalId, {
      status: 'ACTIVE',
      effectiveStatus: 'ACTIVE',
    });
    graphState.statuses.set(adBExternalId, {
      status: 'ACTIVE',
      effectiveStatus: 'ACTIVE',
    });

    const approved = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/campaigns/${campaignBId}/sync`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(approved.body.metaReviewStatus).toBe('approved');
    expect(approved.body.adSets[0].advertisements[0].metaReviewStatus).toBe('approved');
    expect(approved.body.lastSyncedAt).toBeTruthy();

    const history = await dataSource
      .getRepository(MetaReviewStatusHistory)
      .count({ where: { businessId } });
    expect(history).toBeGreaterThan(0);

    const syncLogs = await dataSource
      .getRepository(PlatformSyncLog)
      .count({ where: { businessId } });
    expect(syncLogs).toBeGreaterThan(0);
  });

  it('rejects syncing unpublished campaigns and lists campaign details', async () => {
    const draft = await createCampaign('Sync draft');

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/campaigns/${draft.id}/sync`)
      .set('Authorization', bearer(owner))
      .expect(400);

    const detail = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/campaigns/${campaignBId}`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(detail.body.id).toBe(campaignBId);
    expect(detail.body.statusHistory.length).toBeGreaterThan(0);
    expect(detail.body.adSets).toHaveLength(1);
    expect(detail.body.adSets[0].advertisements).toHaveLength(1);

    const filtered = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/campaigns`)
      .query({ status: AdvertisingStatus.ACTIVE, page: 1, pageSize: 5 })
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(filtered.body.page).toBe(1);
    expect(filtered.body.pageSize).toBe(5);
    expect(
      filtered.body.items.every(
        (campaign: { status: string }) => campaign.status === AdvertisingStatus.ACTIVE,
      ),
    ).toBe(true);
  });
});
