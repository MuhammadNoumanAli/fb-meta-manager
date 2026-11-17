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
import { ApprovalDecision } from '../src/common/enums/approval-decision.enum';
import { ApprovalExecutionStatus } from '../src/common/enums/approval-execution-status.enum';
import { ApprovalStatus } from '../src/common/enums/approval-status.enum';
import { ApprovalTargetType } from '../src/common/enums/approval-target-type.enum';
import { BillingEvent } from '../src/common/enums/billing-event.enum';
import { BudgetAlertStatus } from '../src/common/enums/budget-alert-status.enum';
import { BudgetPeriod } from '../src/common/enums/budget-period.enum';
import { BudgetScope } from '../src/common/enums/budget-scope.enum';
import { BudgetTransactionType } from '../src/common/enums/budget-transaction-type.enum';
import { IntegrationConnectionMode } from '../src/common/enums/integration-connection-mode.enum';
import { IntegrationStatus } from '../src/common/enums/integration-status.enum';
import { OptimizationGoal } from '../src/common/enums/optimization-goal.enum';
import { RoleScope } from '../src/common/enums/role-scope.enum';
import { SpendSnapshotSource } from '../src/common/enums/spend-snapshot-source.enum';
import { AdSet } from '../src/database/entities/ad-set.entity';
import { Advertisement } from '../src/database/entities/advertisement.entity';
import { AdvertisingAsset } from '../src/database/entities/advertising-asset.entity';
import { ApprovalPolicy } from '../src/database/entities/approval-policy.entity';
import { ApprovalRequest } from '../src/database/entities/approval-request.entity';
import { AuditLog } from '../src/database/entities/audit-log.entity';
import { Budget } from '../src/database/entities/budget.entity';
import { BudgetAlert } from '../src/database/entities/budget-alert.entity';
import { BudgetTransaction } from '../src/database/entities/budget-transaction.entity';
import { BusinessUser } from '../src/database/entities/business-user.entity';
import { Business } from '../src/database/entities/business.entity';
import { CampaignStatusHistory } from '../src/database/entities/campaign-status-history.entity';
import { Campaign } from '../src/database/entities/campaign.entity';
import { Creative } from '../src/database/entities/creative.entity';
import { IntegrationAuthorization } from '../src/database/entities/integration-authorization.entity';
import { MetaAdAccount } from '../src/database/entities/meta-ad-account.entity';
import { MetaPage } from '../src/database/entities/meta-page.entity';
import { MetaReviewStatusHistory } from '../src/database/entities/meta-review-status-history.entity';
import { Permission } from '../src/database/entities/permission.entity';
import { PlatformSyncLog } from '../src/database/entities/platform-sync-log.entity';
import { RolePermission } from '../src/database/entities/role-permission.entity';
import { Role } from '../src/database/entities/role.entity';
import { SpendSnapshot } from '../src/database/entities/spend-snapshot.entity';
import { Tenant } from '../src/database/entities/tenant.entity';
import { UserBusinessRole } from '../src/database/entities/user-business-role.entity';
import { User } from '../src/database/entities/user.entity';
import { CampaignPublishingService } from '../src/modules/advertising/campaign-publishing.service';
import { CampaignQueueService } from '../src/modules/advertising/campaign-queue.service';
import { IntegrationCryptoService } from '../src/modules/integrations/integration-crypto.service';
import { MetaGraphClient, MetaGraphError } from '../src/modules/integrations/meta-graph.client';

const API = '/api/v1';
const PASSWORD = 'Str0ngPassw0rd!';
const ACCESS_TOKEN = 'EAAG-phase6-secret-access-token';
const ACCOUNT_ID = 'act-phase6-100';
const PAGE_ID = 'page-phase6-200';
const REQUESTER_ROLE_KEY = 'phase6_requester';
const REQUESTER_PERMISSIONS = [
  'business.read',
  'campaign.read',
  'campaign.create',
  'campaign.update',
  'campaign.publish',
  'budget.manage',
  'approval.request',
  'lead.read',
  'report.read',
];
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

describe('Approvals and budgets (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let publishing: CampaignPublishingService;

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const ownerEmail = `phase6-owner-${suffix}@adpilot.test`;
  const requesterEmail = `phase6-requester-${suffix}@adpilot.test`;
  const viewerEmail = `phase6-viewer-${suffix}@adpilot.test`;
  const strangerEmail = `phase6-stranger-${suffix}@adpilot.test`;

  const userIds: string[] = [];
  const businessIds: string[] = [];
  const tenantIds: string[] = [];
  let requesterRoleId = '';

  let owner: Session;
  let requester: Session;
  let viewer: Session;
  let stranger: Session;
  let businessId: string;
  let secondBusinessId: string;

  let creativeId = '';
  let fullCampaignId = '';
  let directCampaignId = '';

  let businessBudgetId = '';
  let campaignBudgetId = '';
  let publishApprovalId = '';
  let alertId = '';

  const graphState = {
    campaignSeq: 0,
    adSetSeq: 0,
    adSeq: 0,
    creativeSeq: 0,
    imageUploads: 0,
    failOn: null as 'campaign' | 'ad_set' | 'ad' | 'creative' | 'update' | null,
    spend: null as number | null,
    statuses: new Map<string, { status?: string | null; effectiveStatus?: string | null }>(),
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
        effectiveStatus: String(params.status ?? 'PAUSED'),
      });

      return { id };
    },
    createAdSet: async (): Promise<{ id: string }> => {
      if (graphState.failOn === 'ad_set') {
        throw new MetaGraphError('Meta ad set rejected', 400, 100);
      }

      graphState.adSetSeq += 1;
      const id = `meta-adset-${suffix}-${graphState.adSetSeq}`;
      graphState.statuses.set(id, { status: 'PAUSED', effectiveStatus: 'PAUSED' });

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

      if (typeof fields.status === 'string') {
        const fixture = graphState.statuses.get(externalId);

        if (fixture) {
          fixture.status = fields.status;
          fixture.effectiveStatus = fields.status;
        }
      }
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
        issues: [],
      };
    },
    getCampaignSpend: async (): Promise<{
      spend: number | null;
      currency: string | null;
      dateStart: string | null;
      dateStop: string | null;
    }> =>
      graphState.spend === null
        ? { spend: null, currency: null, dateStart: null, dateStop: null }
        : {
            spend: graphState.spend,
            currency: 'MYR',
            dateStart: '2026-11-01',
            dateStop: '2026-11-30',
          },
    uploadAdImage: async (): Promise<{ hash: string; url: string | null }> => {
      graphState.imageUploads += 1;

      return { hash: `meta-image-hash-${graphState.imageUploads}`, url: null };
    },
  };

  // Publishing and status pushes run through the real services, but
  // synchronously so the suite never races the BullMQ worker.
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
    requester = await register(requesterEmail, 'Rita', 'Requester');
    viewer = await register(viewerEmail, 'Vera', 'Viewer');
    stranger = await register(strangerEmail, 'Sam', 'Stranger');

    await seedRequesterRole();

    businessId = await createBusiness('Phase Six Governance');
    secondBusinessId = await createBusiness('Phase Six Other Tenant');

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/members`)
      .set('Authorization', bearer(owner))
      .send({ email: requesterEmail, roleKey: REQUESTER_ROLE_KEY })
      .expect(201);

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/members`)
      .set('Authorization', bearer(owner))
      .send({ email: viewerEmail, roleKey: 'business_viewer' })
      .expect(201);

    await seedMetaIntegration();

    const upload = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/assets`)
      .set('Authorization', bearer(owner))
      .attach('file', PNG, { filename: 'pixel.png', contentType: 'image/png' })
      .expect(201);

    const creative = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/creatives`)
      .set('Authorization', bearer(owner))
      .send({
        name: 'Phase Six creative',
        pageId: await pageId(),
        assetId: upload.body.id,
        headline: 'Govern your spend',
        primaryText: 'Approvals and budgets in one place',
        callToAction: 'LEARN_MORE',
        destinationUrl: 'https://example.com/phase-six',
      })
      .expect(201);
    creativeId = creative.body.id;

    const full = await createFullCampaign('Phase Six Launch');
    fullCampaignId = full.campaign.id;

    directCampaignId = (await createCampaign('Direct publish campaign')).id;
  });

  afterAll(async () => {
    if (businessIds.length > 0) {
      await dataSource.getRepository(BudgetAlert).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(SpendSnapshot).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(BudgetTransaction).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(Budget).delete({ businessId: In(businessIds) });
      // Versions and decisions are removed by the request cascade.
      await dataSource.getRepository(ApprovalRequest).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(ApprovalPolicy).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(PlatformSyncLog).delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(MetaReviewStatusHistory)
        .delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(CampaignStatusHistory)
        .delete({ businessId: In(businessIds) });
      await dataSource.getRepository(Advertisement).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(AdSet).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(Campaign).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(Creative).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(AdvertisingAsset).delete({ businessId: In(businessIds) });
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

    if (requesterRoleId) {
      await dataSource.getRepository(Role).delete({ id: requesterRoleId });
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

  async function seedRequesterRole(): Promise<void> {
    const roleRepo = dataSource.getRepository(Role);
    const permissionRepo = dataSource.getRepository(Permission);
    const rolePermissionRepo = dataSource.getRepository(RolePermission);

    const role = await roleRepo.save(
      roleRepo.create({
        tenantId: null,
        key: REQUESTER_ROLE_KEY,
        name: 'Phase 6 Requester',
        scope: RoleScope.BUSINESS,
        isSystem: false,
      }),
    );
    requesterRoleId = role.id;

    const permissions = await permissionRepo.find({
      where: { key: In(REQUESTER_PERMISSIONS) },
    });

    expect(permissions).toHaveLength(REQUESTER_PERMISSIONS.length);

    await rolePermissionRepo.save(
      permissions.map((permission) =>
        rolePermissionRepo.create({ roleId: role.id, permissionId: permission.id }),
      ),
    );
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

  async function seedMetaIntegration(): Promise<void> {
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
    await adAccountRepo.save(
      adAccountRepo.create({
        authorizationId: authorization.id,
        businessId,
        externalId: ACCOUNT_ID,
        name: 'Phase Six Ad Account',
        accountStatus: 1,
        currency: 'MYR',
        timezoneName: 'Asia/Kuala_Lumpur',
      }),
    );

    const pageRepo = dataSource.getRepository(MetaPage);
    await pageRepo.save(
      pageRepo.create({
        authorizationId: authorization.id,
        businessId,
        externalId: PAGE_ID,
        name: 'Phase Six Page',
        tasks: ['MANAGE'],
      }),
    );
  }

  async function pageId(): Promise<string> {
    const page = await dataSource
      .getRepository(MetaPage)
      .findOneOrFail({ where: { businessId } });

    return page.id;
  }

  async function adAccountId(): Promise<string> {
    const account = await dataSource
      .getRepository(MetaAdAccount)
      .findOneOrFail({ where: { businessId } });

    return account.id;
  }

  async function createCampaign(name: string): Promise<Record<string, any>> {
    const response = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/campaigns`)
      .set('Authorization', bearer(owner))
      .send({
        name,
        objective: AdvertisingObjective.TRAFFIC,
        adAccountId: await adAccountId(),
        dailyBudget: 50,
        specialAdCategories: [],
      })
      .expect(201);

    return response.body;
  }

  async function createFullCampaign(
    name: string,
  ): Promise<{ campaign: Record<string, any>; adSetId: string; advertisementId: string }> {
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
      .post(`${API}/businesses/${businessId}/ad-sets/${adSetResponse.body.id}/advertisements`)
      .set('Authorization', bearer(owner))
      .send({ name: `${name} advertisement`, creativeId })
      .expect(201);

    return {
      campaign,
      adSetId: adSetResponse.body.id,
      advertisementId: advertisementResponse.body.id,
    };
  }

  async function getCampaign(campaignId: string): Promise<Record<string, any>> {
    const response = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/campaigns/${campaignId}`)
      .set('Authorization', bearer(owner))
      .expect(200);

    return response.body;
  }

  async function enablePolicy(targetType: ApprovalTargetType): Promise<void> {
    const response = await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/approvals/policies/${targetType}`)
      .set('Authorization', bearer(owner))
      .send({ isEnabled: true })
      .expect(200);

    expect(response.body).toMatchObject({ targetType, isEnabled: true });
  }

  it('enforces authentication, tenant isolation and approval roles', async () => {
    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/approvals`)
      .expect(401);

    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/approvals`)
      .set('Authorization', bearer(stranger))
      .expect(404);

    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/budgets`)
      .set('Authorization', bearer(stranger))
      .expect(404);

    await request(app.getHttpServer())
      .get(`${API}/businesses/${secondBusinessId}/budgets`)
      .set('Authorization', bearer(requester))
      .expect(404);

    const policies = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/approvals/policies`)
      .set('Authorization', bearer(viewer))
      .expect(200);

    expect(policies.body).toHaveLength(5);
    expect(
      policies.body.map((policy: { targetType: string }) => policy.targetType),
    ).toEqual(
      expect.arrayContaining([
        'campaign.publish',
        'campaign.status',
        'budget.change',
        'automation.execute',
        'bulk.execute',
      ]),
    );
    expect(policies.body.every((policy: { isEnabled: boolean }) => !policy.isEnabled)).toBe(
      true,
    );

    await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/approvals/policies/campaign.publish`)
      .set('Authorization', bearer(requester))
      .send({ isEnabled: true })
      .expect(403);

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/budgets`)
      .set('Authorization', bearer(viewer))
      .send({ scope: BudgetScope.BUSINESS, name: 'Viewer budget', amount: 100 })
      .expect(403);

    const emptyBudgets = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/budgets`)
      .set('Authorization', bearer(viewer))
      .expect(200);

    expect(emptyBudgets.body).toEqual([]);
  });

  it('enables approval policies and keeps direct action for approvers', async () => {
    await enablePolicy(ApprovalTargetType.CAMPAIGN_PUBLISH);
    await enablePolicy(ApprovalTargetType.CAMPAIGN_STATUS);
    await enablePolicy(ApprovalTargetType.BUDGET_CHANGE);

    const direct = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/campaigns/${directCampaignId}/publish`)
      .set('Authorization', bearer(owner))
      .send({ activate: true })
      .expect(202);

    expect(direct.body.approvalRequired).toBeUndefined();
    expect(direct.body.status).toBe(AdvertisingStatus.ACTIVE);
    expect(direct.body.externalId).toBeTruthy();
  });

  it('routes publishing through approval and renews approval for a changed payload', async () => {
    const pending = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/campaigns/${fullCampaignId}/publish`)
      .set('Authorization', bearer(requester))
      .send({ activate: false })
      .expect(202);

    expect(pending.body.approvalRequired).toBe(true);
    expect(pending.body.campaign).toBeNull();
    expect(pending.body.approval).toMatchObject({
      targetType: ApprovalTargetType.CAMPAIGN_PUBLISH,
      status: ApprovalStatus.PENDING,
      currentVersion: 1,
      executionStatus: ApprovalExecutionStatus.NOT_STARTED,
    });
    expect(pending.body.approval.requestedBy.id).toBe(requester.userId);

    publishApprovalId = pending.body.approval.id;

    const draft = await getCampaign(fullCampaignId);
    expect(draft.status).toBe(AdvertisingStatus.DRAFT);
    expect(draft.externalId).toBeNull();

    // Re-submitting the same action with a different payload appends a new
    // version instead of creating a second request, forcing a fresh review.
    const renewed = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/campaigns/${fullCampaignId}/publish`)
      .set('Authorization', bearer(requester))
      .send({ activate: true })
      .expect(202);

    expect(renewed.body.approval.id).toBe(publishApprovalId);
    expect(renewed.body.approval.currentVersion).toBe(2);
    expect(renewed.body.approval.versions).toHaveLength(2);
    expect(renewed.body.approval.versions[1].payload).toEqual({
      campaignId: fullCampaignId,
      activate: true,
    });

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/approvals/${publishApprovalId}/decision`)
      .set('Authorization', bearer(owner))
      .send({ decision: ApprovalDecision.APPROVED, version: 1 })
      .expect(409);

    const approved = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/approvals/${publishApprovalId}/decision`)
      .set('Authorization', bearer(owner))
      .send({
        decision: ApprovalDecision.APPROVED,
        version: 2,
        reason: 'Launch approved',
      })
      .expect(200);

    expect(approved.body.status).toBe(ApprovalStatus.APPROVED);
    expect(approved.body.executionStatus).toBe(ApprovalExecutionStatus.EXECUTED);
    expect(approved.body.approvedVersionId).toBe(renewed.body.approval.versions[1].id);
    expect(approved.body.decidedBy.id).toBe(owner.userId);
    expect(approved.body.decisions).toHaveLength(1);
    expect(approved.body.decisions[0].decision).toBe(ApprovalDecision.APPROVED);

    const published = await getCampaign(fullCampaignId);
    expect(published.status).toBe(AdvertisingStatus.ACTIVE);
    expect(published.externalId).toBeTruthy();
    expect(published.publishedAt).toBeTruthy();
    // AdPilot's lifecycle and Meta's status stay separate fields.
    expect(published.externalStatus).toBe('ACTIVE');

    const mine = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/approvals?status=approved&mine=true`)
      .set('Authorization', bearer(requester))
      .expect(200);

    expect(mine.body.total).toBe(1);
    expect(mine.body.items[0].id).toBe(publishApprovalId);
  });

  it('blocks self decisions and ineligible assigned approvers', async () => {
    const own = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/approvals`)
      .set('Authorization', bearer(owner))
      .send({
        targetType: ApprovalTargetType.CAMPAIGN_STATUS,
        targetId: directCampaignId,
        payload: { campaignId: directCampaignId, status: AdvertisingStatus.PAUSED },
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/approvals/${own.body.id}/decision`)
      .set('Authorization', bearer(owner))
      .send({ decision: ApprovalDecision.APPROVED })
      .expect(400);

    const cancelled = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/approvals/${own.body.id}/cancel`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(cancelled.body.status).toBe(ApprovalStatus.CANCELLED);

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/approvals`)
      .set('Authorization', bearer(requester))
      .send({
        targetType: ApprovalTargetType.CAMPAIGN_STATUS,
        targetId: directCampaignId,
        payload: { campaignId: directCampaignId, status: AdvertisingStatus.PAUSED },
        approverUserId: viewer.userId,
      })
      .expect(400);
  });

  it('gates status changes, rejections and cancellations', async () => {
    const pending = await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/campaigns/${fullCampaignId}/status`)
      .set('Authorization', bearer(requester))
      .send({ status: AdvertisingStatus.PAUSED })
      .expect(200);

    expect(pending.body.approvalRequired).toBe(true);
    expect(pending.body.approval.targetType).toBe(ApprovalTargetType.CAMPAIGN_STATUS);

    const stillActive = await getCampaign(fullCampaignId);
    expect(stillActive.status).toBe(AdvertisingStatus.ACTIVE);

    const approved = await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/approvals/${pending.body.approval.id}/decision`,
      )
      .set('Authorization', bearer(owner))
      .send({ decision: ApprovalDecision.APPROVED })
      .expect(200);

    expect(approved.body.executionStatus).toBe(ApprovalExecutionStatus.EXECUTED);

    const paused = await getCampaign(fullCampaignId);
    expect(paused.status).toBe(AdvertisingStatus.PAUSED);
    expect(graphState.updates).toContainEqual({
      externalId: paused.externalId,
      status: 'PAUSED',
    });

    const rejectedRequest = await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/campaigns/${fullCampaignId}/status`)
      .set('Authorization', bearer(requester))
      .send({ status: AdvertisingStatus.ARCHIVED })
      .expect(200);

    const rejected = await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/approvals/${rejectedRequest.body.approval.id}/decision`,
      )
      .set('Authorization', bearer(owner))
      .send({
        decision: ApprovalDecision.REJECTED,
        reason: 'Keep the campaign live for now',
      })
      .expect(200);

    expect(rejected.body.status).toBe(ApprovalStatus.REJECTED);
    expect(rejected.body.executionStatus).toBe(ApprovalExecutionStatus.NOT_STARTED);
    expect(rejected.body.decisionReason).toBe('Keep the campaign live for now');

    const afterRejection = await getCampaign(fullCampaignId);
    expect(afterRejection.status).toBe(AdvertisingStatus.PAUSED);

    const cancelRequest = await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/campaigns/${fullCampaignId}/status`)
      .set('Authorization', bearer(requester))
      .send({ status: AdvertisingStatus.ACTIVE })
      .expect(200);

    const cancelled = await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/approvals/${cancelRequest.body.approval.id}/cancel`,
      )
      .set('Authorization', bearer(requester))
      .expect(200);

    expect(cancelled.body.status).toBe(ApprovalStatus.CANCELLED);

    const afterCancel = await getCampaign(fullCampaignId);
    expect(afterCancel.status).toBe(AdvertisingStatus.PAUSED);
  });

  it('records execution failure and retries an approved status change', async () => {
    const pending = await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/campaigns/${directCampaignId}/status`)
      .set('Authorization', bearer(requester))
      .send({ status: AdvertisingStatus.PAUSED })
      .expect(200);

    expect(pending.body.approvalRequired).toBe(true);

    graphState.failOn = 'update';

    const failed = await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/approvals/${pending.body.approval.id}/decision`,
      )
      .set('Authorization', bearer(owner))
      .send({ decision: ApprovalDecision.APPROVED })
      .expect(200);

    expect(failed.body.status).toBe(ApprovalStatus.APPROVED);
    expect(failed.body.executionStatus).toBe(ApprovalExecutionStatus.FAILED);
    expect(failed.body.executionError).toContain('Meta rejected the status change');

    const unchanged = await getCampaign(directCampaignId);
    expect(unchanged.status).toBe(AdvertisingStatus.ACTIVE);

    graphState.failOn = null;

    const retried = await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/approvals/${pending.body.approval.id}/execute`,
      )
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(retried.body.executionStatus).toBe(ApprovalExecutionStatus.EXECUTED);

    const paused = await getCampaign(directCampaignId);
    expect(paused.status).toBe(AdvertisingStatus.PAUSED);

    await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/approvals/${publishApprovalId}/execute`,
      )
      .set('Authorization', bearer(owner))
      .expect(200);
  });

  it('creates budgets directly and gates campaign budgets through approval', async () => {
    const clientBudget = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/budgets`)
      .set('Authorization', bearer(owner))
      .send({
        scope: BudgetScope.BUSINESS,
        name: 'Client monthly cap',
        amount: 1000,
        currency: 'MYR',
        period: BudgetPeriod.MONTHLY,
        alertThresholdPercent: 80,
      })
      .expect(201);

    expect(clientBudget.body.approvalRequired).toBe(false);
    expect(clientBudget.body.budget).toMatchObject({
      scope: BudgetScope.BUSINESS,
      amount: '1000.00',
      currency: 'MYR',
      spentAmount: '0.00',
      usagePercent: 0,
    });
    businessBudgetId = clientBudget.body.budget.id;
    expect(businessBudgetId).toBeTruthy();

    const requested = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/budgets`)
      .set('Authorization', bearer(requester))
      .send({
        scope: BudgetScope.CAMPAIGN,
        campaignId: fullCampaignId,
        name: 'Launch budget',
        amount: 100,
        currency: 'MYR',
        period: BudgetPeriod.MONTHLY,
        alertThresholdPercent: 80,
      })
      .expect(201);

    expect(requested.body.approvalRequired).toBe(true);
    expect(requested.body.budget).toBeNull();
    expect(requested.body.approval.targetType).toBe(ApprovalTargetType.BUDGET_CHANGE);
    expect(requested.body.approval.status).toBe(ApprovalStatus.PENDING);

    const whilePending = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/budgets`)
      .set('Authorization', bearer(viewer))
      .expect(200);

    expect(whilePending.body).toHaveLength(1);

    const approved = await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/approvals/${requested.body.approval.id}/decision`,
      )
      .set('Authorization', bearer(owner))
      .send({ decision: ApprovalDecision.APPROVED, reason: 'Budget approved' })
      .expect(200);

    expect(approved.body.executionStatus).toBe(ApprovalExecutionStatus.EXECUTED);

    const list = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/budgets`)
      .set('Authorization', bearer(viewer))
      .expect(200);

    expect(list.body).toHaveLength(2);

    const campaignBudget = list.body.find(
      (budget: { name: string }) => budget.name === 'Launch budget',
    );
    expect(campaignBudget).toMatchObject({
      scope: BudgetScope.CAMPAIGN,
      campaignId: fullCampaignId,
      amount: '100.00',
      alertThresholdPercent: 80,
      isActive: true,
    });
    campaignBudgetId = campaignBudget.id;

    const detail = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/budgets/${campaignBudgetId}`)
      .set('Authorization', bearer(viewer))
      .expect(200);

    expect(detail.body.transactions[0]).toMatchObject({
      type: BudgetTransactionType.CREATED,
      amount: '100.00',
      previousAmount: null,
      approvalRequestId: requested.body.approval.id,
    });
  });

  it('gates budget updates and deletions through approval', async () => {
    const pendingUpdate = await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/budgets/${campaignBudgetId}`)
      .set('Authorization', bearer(requester))
      .send({ amount: 150 })
      .expect(200);

    expect(pendingUpdate.body.approvalRequired).toBe(true);
    expect(pendingUpdate.body.approval.currentVersion).toBe(1);

    const updateRequest = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/approvals/${pendingUpdate.body.approval.id}`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(updateRequest.body.versions[0].payload.values.amount).toBe('150.00');

    await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/approvals/${pendingUpdate.body.approval.id}/decision`,
      )
      .set('Authorization', bearer(owner))
      .send({ decision: ApprovalDecision.APPROVED })
      .expect(200);

    const updated = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/budgets/${campaignBudgetId}`)
      .set('Authorization', bearer(requester))
      .expect(200);

    expect(updated.body.amount).toBe('150.00');
    expect(updated.body.transactions[0]).toMatchObject({
      type: BudgetTransactionType.UPDATED,
      amount: '150.00',
      previousAmount: '100.00',
      approvalRequestId: pendingUpdate.body.approval.id,
    });

    const pendingDelete = await request(app.getHttpServer())
      .delete(`${API}/businesses/${businessId}/budgets/${campaignBudgetId}`)
      .set('Authorization', bearer(requester))
      .expect(200);

    expect(pendingDelete.body.approvalRequired).toBe(true);

    await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/approvals/${pendingDelete.body.approval.id}/cancel`,
      )
      .set('Authorization', bearer(requester))
      .expect(200);

    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/budgets/${campaignBudgetId}`)
      .set('Authorization', bearer(requester))
      .expect(200);
  });

  it('captures Meta spend and raises threshold alerts', async () => {
    graphState.spend = 130;

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/campaigns/${fullCampaignId}/sync`)
      .set('Authorization', bearer(requester))
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/budgets/${campaignBudgetId}`)
      .set('Authorization', bearer(requester))
      .expect(200);

    expect(detail.body.spentAmount).toBe('130.00');
    expect(detail.body.usagePercent).toBe(86.7);
    expect(detail.body.openAlerts).toBe(1);
    expect(detail.body.snapshots[0]).toMatchObject({
      source: SpendSnapshotSource.META_SYNC,
      amount: '130.00',
      currency: 'MYR',
      metadata: { externalId: expect.any(String), datePreset: 'this_month' },
    });
    expect(detail.body.alerts[0]).toMatchObject({
      budgetId: campaignBudgetId,
      thresholdPercent: 80,
      spendAmount: '130.00',
      budgetAmount: '150.00',
      status: BudgetAlertStatus.OPEN,
    });
    alertId = detail.body.alerts[0].id;

    const openAlerts = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/budgets/alerts?status=open`)
      .set('Authorization', bearer(viewer))
      .expect(200);

    expect(openAlerts.body.map((alert: { id: string }) => alert.id)).toContain(alertId);

    const acknowledged = await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/budgets/alerts/${alertId}/acknowledge`)
      .set('Authorization', bearer(requester))
      .expect(200);

    expect(acknowledged.body.status).toBe(BudgetAlertStatus.ACKNOWLEDGED);
    expect(acknowledged.body.acknowledgedByUserId).toBe(requester.userId);

    const manual = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/budgets/${campaignBudgetId}/snapshots`)
      .set('Authorization', bearer(requester))
      .send({ amount: 140, note: 'Finance sheet reconciliation' })
      .expect(201);

    expect(manual.body.spentAmount).toBe('140.00');
    expect(manual.body.openAlerts).toBe(0);
    expect(manual.body.snapshots[0]).toMatchObject({
      source: SpendSnapshotSource.MANUAL,
      amount: '140.00',
      metadata: { note: 'Finance sheet reconciliation' },
    });
    expect(manual.body.alerts[0]).toMatchObject({
      id: alertId,
      spendAmount: '140.00',
      status: BudgetAlertStatus.ACKNOWLEDGED,
    });

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/budgets/${campaignBudgetId}/snapshots`)
      .set('Authorization', bearer(requester))
      .send({ amount: 10, currency: 'USD' })
      .expect(400);

    const afterAck = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/budgets/alerts?status=open`)
      .set('Authorization', bearer(viewer))
      .expect(200);

    expect(afterAck.body).toHaveLength(0);
  });
});
