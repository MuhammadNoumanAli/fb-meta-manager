import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash, createHmac } from 'crypto';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { IntegrationConnectionMode } from '../src/common/enums/integration-connection-mode.enum';
import { IntegrationStatus } from '../src/common/enums/integration-status.enum';
import { LeadSourceType } from '../src/common/enums/lead-source-type.enum';
import { LeadSyncStatus } from '../src/common/enums/lead-sync-status.enum';
import { AuditLog } from '../src/database/entities/audit-log.entity';
import { BusinessUser } from '../src/database/entities/business-user.entity';
import { Business } from '../src/database/entities/business.entity';
import { IntegrationAuthorization } from '../src/database/entities/integration-authorization.entity';
import { LeadSource } from '../src/database/entities/lead-source.entity';
import { LeadSyncLog } from '../src/database/entities/lead-sync-log.entity';
import { Lead } from '../src/database/entities/lead.entity';
import { MetaPage } from '../src/database/entities/meta-page.entity';
import { Tenant } from '../src/database/entities/tenant.entity';
import { UserBusinessRole } from '../src/database/entities/user-business-role.entity';
import { User } from '../src/database/entities/user.entity';
import { WebhookEvent } from '../src/database/entities/webhook-event.entity';
import { WebhookProcessingLog } from '../src/database/entities/webhook-processing-log.entity';
import { IntegrationCryptoService } from '../src/modules/integrations/integration-crypto.service';
import {
  MetaGraphClient,
  MetaGraphError,
  MetaLeadDetails,
} from '../src/modules/integrations/meta-graph.client';
import { LeadIntakeService } from '../src/modules/leads/lead-intake.service';
import { LeadQueueService } from '../src/modules/leads/lead-queue.service';

const API = '/api/v1';
const PASSWORD = 'Str0ngPassw0rd!';
const WEBHOOK_SECRET = 'phase4-test-app-secret';
const VERIFY_TOKEN = 'phase4-test-verify-token';
const ACCESS_TOKEN = 'EAAG-phase4-secret-access-token';
const PAGE_ID = 'page-phase4-100';
const UNKNOWN_PAGE_ID = 'page-phase4-unknown';

jest.setTimeout(30_000);

interface Session {
  userId: string;
  email: string;
  accessToken: string;
}

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

const leadDetails = (id: string): MetaLeadDetails => ({
  id,
  createdTime: '2026-11-16T09:30:00+0000',
  formId: 'form-700',
  adId: 'ad-710',
  adSetId: 'adset-720',
  campaignId: 'campaign-730',
  pageId: PAGE_ID,
  isOrganic: false,
  fields: [
    { name: 'full_name', values: ['Ada Lovelace'] },
    { name: 'email', values: ['ada@example.com'] },
    { name: 'phone_number', values: ['+60111222333'] },
    { name: 'language', values: ['en'] },
    { name: 'message', values: ['Interested in the autumn bundle'] },
    { name: 'marketing_consent', values: ['yes'] },
  ],
});

const alternateDetails = (id: string): MetaLeadDetails => ({
  id,
  createdTime: '2026-11-16T10:00:00+0000',
  formId: 'form-700',
  adId: 'ad-710',
  adSetId: 'adset-720',
  campaignId: 'campaign-730',
  pageId: PAGE_ID,
  isOrganic: false,
  fields: [
    { name: 'first_name', values: ['Ada'] },
    { name: 'last_name', values: ['Lovelace'] },
    { name: 'email', values: ['ada@example.com'] },
    { name: 'phone_number', values: ['+60111222333'] },
    { name: 'marketing_consent', values: ['no'] },
  ],
});

const leadgenPayload = (leadgenId: string, pageId = PAGE_ID) => ({
  object: 'page',
  entry: [
    {
      id: pageId,
      time: Math.floor(Date.now() / 1000),
      changes: [
        {
          field: 'leadgen',
          value: {
            leadgen_id: leadgenId,
            page_id: pageId,
            form_id: 'form-700',
            ad_id: 'ad-710',
          },
        },
      ],
    },
  ],
});

describe('Meta webhooks and lead intake (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let intake: LeadIntakeService;

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const ownerEmail = `phase4-owner-${suffix}@adpilot.test`;
  const outsiderEmail = `phase4-outsider-${suffix}@adpilot.test`;

  const userIds: string[] = [];
  const businessIds: string[] = [];
  const tenantIds: string[] = [];
  const eventIds: string[] = [];

  let owner: Session;
  let outsider: Session;
  let businessId: string;
  let authorizationId: string;

  let websiteKey = '';
  let websiteLeadId = '';
  let metaLeadId = '';

  const graphState = {
    calls: [] as Array<{ leadgenId: string; accessToken: string }>,
    failing: new Set<string>(),
    details: new Map<string, MetaLeadDetails>([
      ['leadgen-9001', leadDetails('leadgen-9001')],
      ['leadgen-9002', leadDetails('leadgen-9002')],
      ['leadgen-9003', alternateDetails('leadgen-9003')],
    ]),
  };

  const graphMock = {
    getLeadDetails: async (leadgenId: string, accessToken: string) => {
      graphState.calls.push({ leadgenId, accessToken });

      if (graphState.failing.has(leadgenId)) {
        throw new MetaGraphError('Graph API is temporarily unavailable', 503, 2);
      }

      const details = graphState.details.get(leadgenId);

      if (!details) {
        throw new MetaGraphError('Lead not found', 404, 100);
      }

      return details;
    },
  };

  // Processing runs through the real LeadIntakeService, but synchronously so the
  // suite never races the BullMQ worker.
  const queueMock = {
    enqueueWebhookEvent: async (eventId: string) => {
      await intake.processWebhookEvent(eventId);
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MetaGraphClient)
      .useValue(graphMock)
      .overrideProvider(LeadQueueService)
      .useValue(queueMock)
      .compile();

    app = moduleFixture.createNestApplication({ logger: false, rawBody: true });
    configureApplication(app);
    await app.init();

    dataSource = app.get(DataSource);
    intake = app.get(LeadIntakeService);

    owner = await register(ownerEmail, 'Olive', 'Owner');
    outsider = await register(outsiderEmail, 'Oscar', 'Outsider');
    businessId = await createBusiness('Phase Four Coffee');

    const crypto = app.get(IntegrationCryptoService);
    const authorizationRepo = dataSource.getRepository(IntegrationAuthorization);
    const authorization = await authorizationRepo.save(
      authorizationRepo.create({
        businessId,
        provider: 'meta',
        connectionMode: IntegrationConnectionMode.CLIENT_OAUTH,
        status: IntegrationStatus.ACTIVE,
        accessTokenEncrypted: crypto.encrypt(ACCESS_TOKEN),
        scopes: ['leads_retrieval', 'pages_show_list'],
        grantedPermissions: ['leads_retrieval', 'pages_show_list'],
        missingPermissions: [],
        tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    );
    authorizationId = authorization.id;

    await dataSource.getRepository(MetaPage).insert({
      authorizationId,
      businessId,
      externalId: PAGE_ID,
      name: 'Phase Four Coffee Page',
      tasks: ['MANAGE', 'LEADGEN'],
    });
  });

  afterAll(async () => {
    if (eventIds.length > 0) {
      await dataSource
        .getRepository(WebhookProcessingLog)
        .delete({ webhookEventId: In(eventIds) });
      await dataSource.getRepository(WebhookEvent).delete({ id: In(eventIds) });
    }

    if (businessIds.length > 0) {
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

  function sign(body: string): string {
    return `sha256=${createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')}`;
  }

  function deliver(payload: unknown) {
    return request(app.getHttpServer())
      .post(`${API}/webhooks/meta`)
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', sign(JSON.stringify(payload)))
      .send(JSON.stringify(payload));
  }

  async function storedEvent(leadgenId: string): Promise<WebhookEvent | null> {
    const event = await dataSource
      .getRepository(WebhookEvent)
      .findOne({ where: { idempotencyKey: sha256(`meta:leadgen:${leadgenId}`) } });

    if (event) {
      eventIds.push(event.id);
    }

    return event;
  }

  it('answers the Meta subscription challenge only for the configured token', async () => {
    const ok = await request(app.getHttpServer())
      .get(`${API}/webhooks/meta`)
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': VERIFY_TOKEN,
        'hub.challenge': 'challenge-12345',
      })
      .expect(200);

    expect(ok.text).toBe('challenge-12345');

    await request(app.getHttpServer())
      .get(`${API}/webhooks/meta`)
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong-token',
        'hub.challenge': 'challenge-12345',
      })
      .expect(403);

    await request(app.getHttpServer())
      .get(`${API}/webhooks/meta`)
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': VERIFY_TOKEN })
      .expect(403);
  });

  it('rejects unsigned, tampered and malformed webhook deliveries', async () => {
    await request(app.getHttpServer())
      .post(`${API}/webhooks/meta`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(leadgenPayload('leadgen-8999')))
      .expect(403);

    const payload = JSON.stringify(leadgenPayload('leadgen-8999'));

    await request(app.getHttpServer())
      .post(`${API}/webhooks/meta`)
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', sign(payload))
      .send(payload.replace('leadgen-8999', 'leadgen-8998'))
      .expect(403);

    const malformed = JSON.stringify({ object: 'page' });

    await request(app.getHttpServer())
      .post(`${API}/webhooks/meta`)
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', sign(malformed))
      .send(malformed)
      .expect(400);

    const stored = await dataSource
      .getRepository(WebhookEvent)
      .find({ where: { idempotencyKey: In([sha256('meta:leadgen:leadgen-8999'), sha256('meta:leadgen:leadgen-8998')]) } });

    expect(stored).toHaveLength(0);
  });

  it('stores a signed leadgen event, decrypts the token and creates a normalised lead', async () => {
    const response = await deliver(leadgenPayload('leadgen-9001')).expect(200);

    expect(response.body).toEqual({ received: 1, duplicates: 0 });

    const event = await storedEvent('leadgen-9001');

    expect(event).not.toBeNull();
    expect(event?.status).toBe('processed');
    expect(event?.businessId).toBe(businessId);
    expect(event?.authorizationId).toBe(authorizationId);
    expect(event?.attempts).toBe(1);
    expect(event?.processedAt).toBeTruthy();

    // The encrypted credential round-trips only in memory.
    expect(graphState.calls[0]).toEqual({
      leadgenId: 'leadgen-9001',
      accessToken: ACCESS_TOKEN,
    });

    const lead = await dataSource.getRepository(Lead).findOneOrFail({
      where: { externalLeadId: 'leadgen-9001', businessId },
    });
    metaLeadId = lead.id;

    expect(lead).toMatchObject({
      sourcePlatform: 'meta_lead_ads',
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+60111222333',
      language: 'en',
      message: 'Interested in the autumn bundle',
      consentStatus: 'granted',
      status: 'new',
      formId: 'form-700',
      campaignExternalId: 'campaign-730',
      adSetExternalId: 'adset-720',
      adExternalId: 'ad-710',
      pageExternalId: PAGE_ID,
    });
    expect(lead.dedupeHash).toBe(sha256('meta:leadgen-9001'));
    expect(lead.rawPayload).toMatchObject({ id: 'leadgen-9001' });

    const syncLog = await dataSource.getRepository(LeadSyncLog).findOne({
      where: { businessId, externalLeadId: 'leadgen-9001', status: LeadSyncStatus.CREATED },
    });

    expect(syncLog).not.toBeNull();

    const list = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/leads`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).toMatchObject({
      id: metaLeadId,
      sourcePlatform: 'meta_lead_ads',
      fullName: 'Ada Lovelace',
    });
  });

  it('ignores a duplicate delivery without creating a second lead', async () => {
    const response = await deliver(leadgenPayload('leadgen-9001')).expect(200);

    expect(response.body).toEqual({ received: 0, duplicates: 1 });

    const leads = await dataSource
      .getRepository(Lead)
      .find({ where: { businessId, externalLeadId: 'leadgen-9001' } });

    expect(leads).toHaveLength(1);

    const events = await dataSource
      .getRepository(WebhookEvent)
      .find({ where: { idempotencyKey: sha256('meta:leadgen:leadgen-9001') } });

    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('processed');
  });

  it('never merges distinct leadgen ids that share contact details', async () => {
    await deliver(leadgenPayload('leadgen-9003')).expect(200);

    const leads = await dataSource
      .getRepository(Lead)
      .find({ where: { businessId, sourcePlatform: LeadSourceType.META_LEAD_ADS } });

    expect(leads).toHaveLength(2);
    const alternate = leads.find((lead) => lead.externalLeadId === 'leadgen-9003');

    expect(alternate).toMatchObject({
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      consentStatus: 'denied',
    });
  });

  it('stores deliveries from unknown pages as ignored events', async () => {
    const response = await deliver(
      leadgenPayload('leadgen-9004', UNKNOWN_PAGE_ID),
    ).expect(200);

    expect(response.body).toEqual({ received: 1, duplicates: 0 });

    const event = await storedEvent('leadgen-9004');

    expect(event).not.toBeNull();
    expect(event?.status).toBe('ignored');
    expect(event?.businessId).toBeNull();

    const list = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/integrations/meta/webhook-events`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(list.body.some((entry: { id: string }) => entry.id === event?.id)).toBe(
      false,
    );
  });

  it('issues a website key that is stored as a hash and returned only once', async () => {
    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/lead-sources/website`)
      .set('Authorization', bearer(outsider))
      .expect(404);

    const issued = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/lead-sources/website`)
      .set('Authorization', bearer(owner))
      .expect(201);

    websiteKey = issued.body.apiKey as string;

    expect(websiteKey).toMatch(/^adp_[a-f0-9]{48}$/);
    expect(issued.body.source).toMatchObject({
      type: 'website_api',
      hasApiKey: true,
      isActive: true,
      apiKeyHint: websiteKey.slice(-4),
    });
    expect(JSON.stringify(issued.body.source)).not.toContain(websiteKey);

    const stored = await dataSource
      .getRepository(LeadSource)
      .findOneOrFail({ where: { businessId, type: LeadSourceType.WEBSITE_API } });

    expect(stored.apiKeyHash).toBe(sha256(websiteKey));
    expect(stored.apiKeyHash).not.toBe(websiteKey);
    expect(stored.apiKeyHint).toBe(websiteKey.slice(-4));

    // Rotation invalidates the previous key immediately.
    const rotated = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/lead-sources/website`)
      .set('Authorization', bearer(owner))
      .expect(201);

    const previousKey = websiteKey;
    websiteKey = rotated.body.apiKey as string;

    expect(websiteKey).not.toBe(previousKey);
  });

  it('accepts website leads idempotently and validates the payload', async () => {
    const payload = {
      fullName: 'Grace Hopper',
      email: 'Grace@Example.com',
      phone: '+60123456789',
      language: 'en',
      message: 'Please send pricing',
      consent: true,
      externalId: 'web-lead-1',
      campaignId: 'campaign-web',
      metadata: { page: '/pricing' },
    };

    const created = await request(app.getHttpServer())
      .post(`${API}/leads/intake`)
      .set('x-adpilot-lead-key', websiteKey)
      .send(payload)
      .expect(201);

    expect(created.body).toMatchObject({ accepted: true, duplicate: false });
    websiteLeadId = created.body.id as string;

    const lead = await dataSource
      .getRepository(Lead)
      .findOneOrFail({ where: { id: websiteLeadId } });

    expect(lead).toMatchObject({
      businessId,
      sourcePlatform: 'website_api',
      externalLeadId: 'web-lead-1',
      fullName: 'Grace Hopper',
      email: 'grace@example.com',
      consentStatus: 'granted',
      status: 'new',
      campaignExternalId: 'campaign-web',
    });
    expect(lead.dedupeHash).toBe(sha256(`website:${businessId}:web-lead-1`));
    expect(lead.rawPayload).toMatchObject({ metadata: { page: '/pricing' } });

    const repeated = await request(app.getHttpServer())
      .post(`${API}/leads/intake`)
      .set('x-adpilot-lead-key', websiteKey)
      .send(payload)
      .expect(201);

    expect(repeated.body).toMatchObject({
      id: websiteLeadId,
      duplicate: true,
    });

    const count = await dataSource
      .getRepository(Lead)
      .count({ where: { businessId, externalLeadId: 'web-lead-1' } });
    expect(count).toBe(1);

    await request(app.getHttpServer())
      .post(`${API}/leads/intake`)
      .set('x-adpilot-lead-key', websiteKey)
      .send({ consent: true })
      .expect(400);

    const logs = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/leads/sync-logs`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(
      logs.body.some(
        (entry: { sourcePlatform: string; status: string }) =>
          entry.sourcePlatform === 'website_api' && entry.status === 'created',
      ),
    ).toBe(true);
  });

  it('rejects invalid or revoked website keys', async () => {
    await request(app.getHttpServer())
      .post(`${API}/leads/intake`)
      .set('x-adpilot-lead-key', 'adp_not-a-real-key')
      .send({ fullName: 'Unknown Visitor' })
      .expect(401);

    await request(app.getHttpServer())
      .post(`${API}/leads/intake`)
      .send({ fullName: 'No Key Visitor' })
      .expect(401);

    const revoked = await request(app.getHttpServer())
      .delete(`${API}/businesses/${businessId}/lead-sources/website`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(revoked.body).toMatchObject({
      type: 'website_api',
      hasApiKey: false,
      isActive: false,
    });

    await request(app.getHttpServer())
      .post(`${API}/leads/intake`)
      .set('x-adpilot-lead-key', websiteKey)
      .send({ fullName: 'Late Visitor' })
      .expect(401);
  });

  it('reports failed deliveries and processes them again on retry', async () => {
    graphState.failing.add('leadgen-9002');

    const received = await deliver(leadgenPayload('leadgen-9002')).expect(200);
    expect(received.body).toEqual({ received: 1, duplicates: 0 });

    const failed = await storedEvent('leadgen-9002');

    expect(failed).not.toBeNull();
    expect(failed?.status).toBe('failed');
    expect(failed?.lastError).toContain('temporarily unavailable');

    const failedList = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/integrations/meta/webhook-events`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(
      failedList.body.find((entry: { id: string }) => entry.id === failed?.id),
    ).toMatchObject({ status: 'failed' });

    graphState.failing.delete('leadgen-9002');

    const retried = await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/integrations/meta/webhook-events/${failed?.id}/retry`,
      )
      .set('Authorization', bearer(owner))
      .expect(201);

    expect(retried.body).toMatchObject({
      id: failed?.id,
      status: 'processed',
      lastError: null,
    });
    expect(retried.body.attempts).toBeGreaterThanOrEqual(2);

    const lead = await dataSource
      .getRepository(Lead)
      .findOne({ where: { businessId, externalLeadId: 'leadgen-9002' } });
    expect(lead).not.toBeNull();

    const detail = await request(app.getHttpServer())
      .get(
        `${API}/businesses/${businessId}/integrations/meta/webhook-events/${failed?.id}`,
      )
      .set('Authorization', bearer(owner))
      .expect(200);

    const statuses = detail.body.logs.map((log: { status: string }) => log.status);
    expect(statuses).toEqual(expect.arrayContaining(['failed', 'retry_queued', 'processed']));
    expect(JSON.stringify(detail.body)).not.toContain(ACCESS_TOKEN);

    await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/integrations/meta/webhook-events/${failed?.id}/retry`,
      )
      .set('Authorization', bearer(owner))
      .expect(400);

    const audits = await dataSource
      .getRepository(AuditLog)
      .find({ where: { businessId, action: 'webhook_event.retried' } });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  it('lists webhook events and exposes processing history for a business', async () => {
    const response = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/integrations/meta/webhook-events?limit=1`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(response.body).toHaveLength(1);

    const created = await storedEvent('leadgen-9001');
    const detail = await request(app.getHttpServer())
      .get(
        `${API}/businesses/${businessId}/integrations/meta/webhook-events/${created?.id}`,
      )
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(detail.body).toMatchObject({
      id: created?.id,
      field: 'leadgen',
      status: 'processed',
    });
    expect(detail.body.logs.length).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .get(
        `${API}/businesses/${businessId}/integrations/meta/webhook-events/00000000-0000-0000-0000-000000000000`,
      )
      .set('Authorization', bearer(owner))
      .expect(404);
  });

  it('updates lead status with an audit trail and rejects invalid transitions', async () => {
    const response = await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/leads/${metaLeadId}`)
      .set('Authorization', bearer(owner))
      .send({ status: 'qualified' })
      .expect(200);

    expect(response.body.status).toBe('qualified');

    const lead = await dataSource
      .getRepository(Lead)
      .findOneOrFail({ where: { id: metaLeadId } });
    expect(lead.status).toBe('qualified');

    const audits = await dataSource.getRepository(AuditLog).find({
      where: { businessId, action: 'lead.status_changed' },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].entityId).toBe(metaLeadId);

    await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/leads/${metaLeadId}`)
      .set('Authorization', bearer(owner))
      .send({ status: 'not-a-status' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/leads/${metaLeadId}`)
      .set('Authorization', bearer(outsider))
      .send({ status: 'contacted' })
      .expect(404);
  });

  it('keeps leads and webhook events isolated per business and login', async () => {
    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/leads`)
      .set('Authorization', bearer(outsider))
      .expect(404);

    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/leads/${metaLeadId}`)
      .set('Authorization', bearer(outsider))
      .expect(404);

    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/integrations/meta/webhook-events`)
      .set('Authorization', bearer(outsider))
      .expect(404);

    const created = await storedEvent('leadgen-9001');

    await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/integrations/meta/webhook-events/${created?.id}/retry`,
      )
      .set('Authorization', bearer(outsider))
      .expect(404);

    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/leads`)
      .expect(401);

    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/lead-sources`)
      .expect(401);
  });
});
