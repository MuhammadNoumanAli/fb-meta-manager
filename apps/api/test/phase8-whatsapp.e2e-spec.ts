import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHmac } from 'crypto';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { LeadConsentStatus } from '../src/common/enums/lead-consent-status.enum';
import { SuppressionReason } from '../src/common/enums/suppression-reason.enum';
import { WhatsappAccountStatus } from '../src/common/enums/whatsapp-account-status.enum';
import { WhatsappMessageDirection } from '../src/common/enums/whatsapp-message-direction.enum';
import { WhatsappMessageStatus } from '../src/common/enums/whatsapp-message-status.enum';
import { WhatsappProvider } from '../src/common/enums/whatsapp-provider.enum';
import { WhatsappTemplateCategory } from '../src/common/enums/whatsapp-template-category.enum';
import { WhatsappTemplateStatus } from '../src/common/enums/whatsapp-template-status.enum';
import { AuditLog } from '../src/database/entities/audit-log.entity';
import { BusinessUser } from '../src/database/entities/business-user.entity';
import { Business } from '../src/database/entities/business.entity';
import { CommunicationSuppression } from '../src/database/entities/communication-suppression.entity';
import { LeadConsent } from '../src/database/entities/lead-consent.entity';
import { Lead } from '../src/database/entities/lead.entity';
import { Tenant } from '../src/database/entities/tenant.entity';
import { UserBusinessRole } from '../src/database/entities/user-business-role.entity';
import { User } from '../src/database/entities/user.entity';
import { WhatsappAccount } from '../src/database/entities/whatsapp-account.entity';
import { WhatsappMessageEvent } from '../src/database/entities/whatsapp-message-event.entity';
import { WhatsappMessage } from '../src/database/entities/whatsapp-message.entity';
import { WhatsappPhoneNumber } from '../src/database/entities/whatsapp-phone-number.entity';
import { WhatsappTemplate } from '../src/database/entities/whatsapp-template.entity';
import { IntegrationCryptoService } from '../src/modules/integrations/integration-crypto.service';
import { MetaWhatsappProvider } from '../src/modules/whatsapp/providers/meta-whatsapp.provider';
import type {
  ProviderAccountInfo,
  ProviderSendContext,
  ProviderSendResult,
  TemplateMessageInput,
} from '../src/modules/whatsapp/providers/messaging-provider';
import { ProviderError } from '../src/modules/whatsapp/providers/messaging-provider';
import { TwilioWhatsappProvider } from '../src/modules/whatsapp/providers/twilio-whatsapp.provider';
import { WhatsappMessagingService } from '../src/modules/whatsapp/whatsapp-messaging.service';
import { WhatsappQueueService } from '../src/modules/whatsapp/whatsapp-queue.service';

const API = '/api/v1';
const PASSWORD = 'Str0ngPassw0rd!';
const WEBHOOK_SECRET = 'phase4-test-app-secret';
const VERIFY_TOKEN = 'phase4-test-verify-token';

const META_TOKEN = 'meta-phase8-access-token';
const META_WABA_ID = 'waba-phase8-100';
const META_PHONE_ID = 'phone-phase8-100';
const META_DISPLAY = '+60123456789';
const META_VERIFIED_DISPLAY = '+60 12-345 6789';

const TWILIO_SID = 'ACphase8twilioaccount000000000000';
const TWILIO_TOKEN = 'twilio-phase8-auth-token';
const TWILIO_SENDER = '+60111111111';
const TWILIO_WEBHOOK_URL = 'https://adpilot.test/api/v1/webhooks/whatsapp/twilio';

// The webhook service verifies Twilio signatures against a configured URL when
// one is present, which keeps the HMAC deterministic inside the test suite.
process.env.TWILIO_WEBHOOK_URL = TWILIO_WEBHOOK_URL;

jest.setTimeout(60_000);

interface Session {
  userId: string;
  email: string;
  accessToken: string;
}

interface ProviderCall {
  context: ProviderSendContext;
  input: TemplateMessageInput;
}

interface TemplateView {
  id: string;
  name: string;
  language: string;
  status: WhatsappTemplateStatus;
  isAcknowledgment: boolean;
  approvedAt: string | null;
}

describe('WhatsApp messaging (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let crypto: IntegrationCryptoService;
  let messaging: WhatsappMessagingService;

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const ownerEmail = `phase8-owner-${suffix}@adpilot.test`;
  const strangerEmail = `phase8-stranger-${suffix}@adpilot.test`;

  const userIds: string[] = [];
  const businessIds: string[] = [];
  const tenantIds: string[] = [];

  let owner: Session;
  let stranger: Session;
  let businessId: string;
  let metaAccountId: string;
  let twilioAccountId: string;
  let websiteKey: string;

  let enTemplate: TemplateView;
  let msTemplate: TemplateView;
  let promoDraftId: string;
  let promoApprovedId: string;

  let englishLeadId: string;
  let malayLeadId: string;
  let manualLeadId: string;
  let stopLeadId: string;
  let transientLeadId: string;
  let persistentLeadId: string;
  let permanentLeadId: string;
  let twilioLeadId: string;

  const metaState = {
    calls: [] as ProviderCall[],
    failures: [] as Error[],
    verifyCalls: 0,
    verifyError: null as Error | null,
  };

  const twilioState = {
    calls: [] as ProviderCall[],
    failures: [] as Error[],
  };

  const metaProvider = {
    name: WhatsappProvider.META,
    async sendTemplateMessage(
      context: ProviderSendContext,
      input: TemplateMessageInput,
    ): Promise<ProviderSendResult> {
      metaState.calls.push({ context, input });
      const failure = metaState.failures.shift();

      if (failure) {
        throw failure;
      }

      return {
        externalMessageId: `wamid.phase8.${metaState.calls.length}`,
        payload: { mocked: 'meta', to: input.toPhone },
      };
    },
    async verifyAccount(): Promise<ProviderAccountInfo> {
      metaState.verifyCalls += 1;

      if (metaState.verifyError) {
        throw metaState.verifyError;
      }

      return {
        displayPhoneNumber: META_VERIFIED_DISPLAY,
        qualityRating: 'GREEN',
        name: 'Phase Eight Sender',
      };
    },
  };

  const twilioProvider = {
    name: WhatsappProvider.TWILIO,
    async sendTemplateMessage(
      context: ProviderSendContext,
      input: TemplateMessageInput,
    ): Promise<ProviderSendResult> {
      twilioState.calls.push({ context, input });
      const failure = twilioState.failures.shift();

      if (failure) {
        throw failure;
      }

      return {
        externalMessageId: `SM${String(twilioState.calls.length).padStart(8, '0')}`,
        payload: { mocked: 'twilio', to: input.toPhone },
      };
    },
    async verifyAccount(context: ProviderSendContext): Promise<ProviderAccountInfo> {
      return {
        displayPhoneNumber: context.phoneNumberDisplay,
        qualityRating: null,
        name: 'Phase Eight Twilio',
      };
    },
  };

  // Delivery runs synchronously, mirroring the BullMQ worker and its three
  // attempts without racing the real queue.
  const queueMock = {
    enqueue: async (messageId: string): Promise<void> => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await app.get(WhatsappMessagingService).deliver(messageId);
          return;
        } catch {
          // Retryable failures reset the row to queued; loop again like BullMQ.
        }
      }
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MetaWhatsappProvider)
      .useValue(metaProvider)
      .overrideProvider(TwilioWhatsappProvider)
      .useValue(twilioProvider)
      .overrideProvider(WhatsappQueueService)
      .useValue(queueMock)
      .compile();

    app = moduleFixture.createNestApplication({ logger: false, rawBody: true });
    configureApplication(app);
    await app.init();

    dataSource = app.get(DataSource);
    crypto = app.get(IntegrationCryptoService);
    messaging = app.get(WhatsappMessagingService);

    owner = await register(ownerEmail, 'Owen', 'Owner');
    stranger = await register(strangerEmail, 'Sam', 'Stranger');
    businessId = await createBusiness('Phase Eight Messaging');

    await connectAccounts();
    await seedTemplates();
    websiteKey = await issueWebsiteKey();
  });

  afterAll(async () => {
    if (businessIds.length > 0) {
      await dataSource
        .getRepository(WhatsappMessageEvent)
        .delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(WhatsappMessage)
        .delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(CommunicationSuppression)
        .delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(LeadConsent)
        .delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(WhatsappTemplate)
        .delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(WhatsappPhoneNumber)
        .delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(WhatsappAccount)
        .delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(AuditLog)
        .delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(UserBusinessRole)
        .delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(BusinessUser)
        .delete({ businessId: In(businessIds) });
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

  async function connectAccounts(): Promise<void> {
    const meta = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/accounts`)
      .set('Authorization', bearer(owner))
      .send({
        provider: WhatsappProvider.META,
        name: 'Phase Eight Cloud API',
        externalAccountId: META_WABA_ID,
        accessToken: META_TOKEN,
        businessAccountId: META_WABA_ID,
        phoneNumbers: [
          {
            externalPhoneNumberId: META_PHONE_ID,
            displayPhoneNumber: META_DISPLAY,
            isDefault: true,
          },
        ],
      })
      .expect(201);

    metaAccountId = meta.body.id as string;

    const twilio = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/accounts`)
      .set('Authorization', bearer(owner))
      .send({
        provider: WhatsappProvider.TWILIO,
        name: 'Phase Eight Twilio',
        externalAccountId: TWILIO_SID,
        accessToken: TWILIO_TOKEN,
        phoneNumbers: [
          {
            externalPhoneNumberId: TWILIO_SENDER,
            displayPhoneNumber: TWILIO_SENDER,
          },
        ],
      })
      .expect(201);

    twilioAccountId = twilio.body.id as string;
  }

  async function seedTemplates(): Promise<void> {
    const seeded = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/templates/seed-defaults`)
      .set('Authorization', bearer(owner))
      .expect(201);

    const items = seeded.body as TemplateView[];
    enTemplate = items.find((item) => item.language === 'en')!;
    msTemplate = items.find((item) => item.language === 'ms')!;
  }

  async function issueWebsiteKey(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/lead-sources/website`)
      .set('Authorization', bearer(owner))
      .expect(201);

    return response.body.apiKey as string;
  }

  async function createWebsiteLead(input: {
    externalId: string;
    fullName: string;
    phone: string;
    consent?: boolean;
    language?: string;
  }): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`${API}/leads/intake`)
      .set('x-adpilot-lead-key', websiteKey)
      .send(input)
      .expect(201);

    return response.body.id as string;
  }

  async function grantConsent(leadId: string): Promise<void> {
    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/consents`)
      .set('Authorization', bearer(owner))
      .send({ leadId, status: LeadConsentStatus.GRANTED })
      .expect(201);
  }

  async function messageDetail(messageId: string) {
    const response = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/whatsapp/messages/${messageId}`)
      .set('Authorization', bearer(owner))
      .expect(200);

    return response.body as {
      id: string;
      status: WhatsappMessageStatus;
      attempts: number;
      error: string | null;
      externalMessageId: string | null;
      deliveredAt: string | null;
      readAt: string | null;
      events: Array<{ eventType: string | null; status: WhatsappMessageStatus }>;
    };
  }

  async function countEvents(
    messageId: string,
    eventType: string,
  ): Promise<number> {
    return dataSource
      .getRepository(WhatsappMessageEvent)
      .count({ where: { messageId, eventType } });
  }

  const signMeta = (rawBody: string): string =>
    `sha256=${createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')}`;

  const postMetaWebhook = (payload: unknown) => {
    const rawBody = JSON.stringify(payload);

    return request(app.getHttpServer())
      .post(`${API}/webhooks/whatsapp/meta`)
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signMeta(rawBody))
      .send(rawBody);
  };

  const metaStatusPayload = (
    externalMessageId: string,
    status: string,
    timestamp: number,
  ) => ({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: META_WABA_ID,
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: META_PHONE_ID },
              statuses: [
                {
                  id: externalMessageId,
                  status,
                  timestamp: String(timestamp),
                  recipient_id: '60123456789',
                },
              ],
            },
          },
        ],
      },
    ],
  });

  const metaInboundPayload = (from: string, body: string, id: string) => ({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: META_WABA_ID,
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: META_PHONE_ID },
              messages: [
                {
                  from,
                  id,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  const signTwilio = (params: Record<string, string>): string => {
    const payload = Object.keys(params)
      .sort()
      .reduce((accumulator, key) => `${accumulator}${key}${params[key]}`, TWILIO_WEBHOOK_URL);

    return createHmac('sha1', TWILIO_TOKEN).update(payload).digest('base64');
  };

  const postTwilioWebhook = (params: Record<string, string>) =>
    request(app.getHttpServer())
      .post(`${API}/webhooks/whatsapp/twilio`)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .set('x-twilio-signature', signTwilio(params))
      .send(new URLSearchParams(params).toString());

  it('connects accounts, hides credentials and validates them with the provider', async () => {
    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/whatsapp/accounts`)
      .set('Authorization', bearer(stranger))
      .expect(404);

    const listed = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/whatsapp/accounts`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(listed.body).toHaveLength(2);
    expect(JSON.stringify(listed.body)).not.toContain(META_TOKEN);
    expect(JSON.stringify(listed.body)).not.toContain(TWILIO_TOKEN);

    const metaView = listed.body.find(
      (account: { provider: string }) => account.provider === WhatsappProvider.META,
    );

    expect(metaView).toMatchObject({
      id: metaAccountId,
      status: WhatsappAccountStatus.ACTIVE,
      hasCredentials: true,
    });
    expect(metaView.phoneNumbers[0]).toMatchObject({
      externalPhoneNumberId: META_PHONE_ID,
      isDefault: true,
    });

    const stored = await dataSource
      .getRepository(WhatsappAccount)
      .findOneOrFail({ where: { id: metaAccountId } });

    expect(stored.credentialsEncrypted).not.toBe(META_TOKEN);
    expect(stored.credentialsEncrypted).not.toContain(META_TOKEN);
    expect(
      JSON.parse(crypto.decrypt(stored.credentialsEncrypted)),
    ).toMatchObject({
      accessToken: META_TOKEN,
      businessAccountId: META_WABA_ID,
    });

    const validated = await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/whatsapp/accounts/${metaAccountId}/validate`,
      )
      .set('Authorization', bearer(owner))
      .expect(201);

    expect(metaState.verifyCalls).toBe(1);
    expect(validated.body).toMatchObject({ status: WhatsappAccountStatus.ACTIVE });
    expect(validated.body.lastValidatedAt).not.toBeNull();
    expect(validated.body.phoneNumbers[0]).toMatchObject({
      displayPhoneNumber: META_VERIFIED_DISPLAY,
      qualityRating: 'GREEN',
    });

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/accounts`)
      .set('Authorization', bearer(owner))
      .send({
        provider: WhatsappProvider.META,
        name: 'Duplicate Cloud API',
        externalAccountId: META_WABA_ID,
        accessToken: META_TOKEN,
        phoneNumbers: [
          {
            externalPhoneNumberId: 'other-phone',
            displayPhoneNumber: '+60100000000',
          },
        ],
      })
      .expect(409);

    const twilioValidated = await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/whatsapp/accounts/${twilioAccountId}/validate`,
      )
      .set('Authorization', bearer(owner))
      .expect(201);

    expect(twilioValidated.body.status).toBe(WhatsappAccountStatus.ACTIVE);
  });

  it('seeds bilingual acknowledgment templates idempotently', async () => {
    const again = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/templates/seed-defaults`)
      .set('Authorization', bearer(owner))
      .expect(201);

    expect(again.body).toHaveLength(0);

    const listed = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/whatsapp/templates`)
      .set('Authorization', bearer(owner))
      .expect(200);

    const templates = listed.body.items as TemplateView[];
    const english = templates.find((item) => item.language === 'en');
    const malay = templates.find((item) => item.language === 'ms');

    expect(english).toMatchObject({
      name: 'lead_acknowledgment',
      status: WhatsappTemplateStatus.APPROVED,
      isAcknowledgment: true,
    });
    expect(malay).toMatchObject({
      name: 'lead_acknowledgment',
      status: WhatsappTemplateStatus.APPROVED,
      isAcknowledgment: true,
    });
    expect(english!.approvedAt).not.toBeNull();
    expect(malay!.approvedAt).not.toBeNull();
  });

  it('acknowledges consenting leads once and respects language and consent', async () => {
    englishLeadId = await createWebsiteLead({
      externalId: `web-en-${suffix}`,
      fullName: 'Aisyah Rahman',
      phone: '+60111000001',
      consent: true,
      language: 'en',
    });

    const acknowledgment = await dataSource
      .getRepository(WhatsappMessage)
      .findOneOrFail({
        where: { leadId: englishLeadId, idempotencyKey: `ack:${englishLeadId}` },
      });

    expect(acknowledgment).toMatchObject({
      businessId,
      direction: WhatsappMessageDirection.OUTBOUND,
      status: WhatsappMessageStatus.SENT,
      toPhone: '60111000001',
      templateId: enTemplate.id,
    });
    expect(acknowledgment.body).toContain('Aisyah Rahman');
    expect(acknowledgment.body).toContain('Phase Eight Messaging');
    expect(acknowledgment.externalMessageId).toBeTruthy();

    const lastCall = metaState.calls[metaState.calls.length - 1];
    expect(lastCall.input).toMatchObject({
      toPhone: '60111000001',
      templateName: 'lead_acknowledgment',
      language: 'en',
      variables: { '1': 'Aisyah Rahman', '2': 'Phase Eight Messaging' },
    });
    expect(lastCall.context.credentials.accessToken).toBe(META_TOKEN);

    // The acknowledgment is idempotent even when triggered twice.
    const callCount = metaState.calls.length;
    const repeated = await messaging.sendAcknowledgment(englishLeadId);
    expect(repeated?.id).toBe(acknowledgment.id);
    expect(metaState.calls).toHaveLength(callCount);

    malayLeadId = await createWebsiteLead({
      externalId: `web-ms-${suffix}`,
      fullName: 'Siti Nurhaliza',
      phone: '+60111000003',
      consent: true,
      language: 'ms',
    });

    const malayMessage = await dataSource
      .getRepository(WhatsappMessage)
      .findOneOrFail({
        where: { leadId: malayLeadId, idempotencyKey: `ack:${malayLeadId}` },
      });

    expect(malayMessage.templateId).toBe(msTemplate.id);
    expect(malayMessage.body).toContain('Hai Siti Nurhaliza');
    expect(malayMessage.status).toBe(WhatsappMessageStatus.SENT);
    expect(
      metaState.calls[metaState.calls.length - 1].input.language,
    ).toBe('ms');

    const beforeNoConsent = metaState.calls.length;
    const noConsentLeadId = await createWebsiteLead({
      externalId: `web-no-consent-${suffix}`,
      fullName: 'Nora Idris',
      phone: '+60111000002',
      language: 'en',
    });

    const noAck = await dataSource
      .getRepository(WhatsappMessage)
      .findOne({
        where: {
          leadId: noConsentLeadId,
          idempotencyKey: `ack:${noConsentLeadId}`,
        },
      });

    expect(noAck).toBeNull();
    expect(metaState.calls).toHaveLength(beforeNoConsent);
  });

  it('only sends approved templates and records blocked attempts', async () => {
    const created = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/templates`)
      .set('Authorization', bearer(owner))
      .send({
        name: 'november_promo',
        language: 'en',
        category: WhatsappTemplateCategory.MARKETING,
        body: 'Hi {{1}}, our November promotion is live.',
        variableMapping: { '1': 'lead.fullName' },
      })
      .expect(201);

    promoDraftId = created.body.id as string;
    expect(created.body.status).toBe(WhatsappTemplateStatus.DRAFT);

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/messages`)
      .set('Authorization', bearer(owner))
      .send({ leadId: englishLeadId, templateId: promoDraftId })
      .expect(400);

    const submitted = await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/whatsapp/templates/${promoDraftId}/submit`,
      )
      .set('Authorization', bearer(owner))
      .expect(201);

    expect(submitted.body.status).toBe(WhatsappTemplateStatus.PENDING);

    const approved = await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/whatsapp/templates/${promoDraftId}/approve`,
      )
      .set('Authorization', bearer(owner))
      .expect(201);

    expect(approved.body.status).toBe(WhatsappTemplateStatus.APPROVED);
    promoApprovedId = promoDraftId;

    const rejectedDraft = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/templates`)
      .set('Authorization', bearer(owner))
      .send({
        name: 'holiday_reject',
        language: 'en',
        category: WhatsappTemplateCategory.MARKETING,
        body: 'Holiday offers are here.',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/whatsapp/templates/${rejectedDraft.body.id}/submit`,
      )
      .set('Authorization', bearer(owner))
      .expect(201);

    const rejected = await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/whatsapp/templates/${rejectedDraft.body.id}/reject`,
      )
      .set('Authorization', bearer(owner))
      .send({ reason: 'Marketing copy needs review' })
      .expect(201);

    expect(rejected.body).toMatchObject({
      status: WhatsappTemplateStatus.REJECTED,
      rejectionReason: 'Marketing copy needs review',
      isAcknowledgment: false,
    });

    // Consent is still required, so a consenting lead is created explicitly.
    manualLeadId = await createWebsiteLead({
      externalId: `web-manual-${suffix}`,
      fullName: 'Mei Ling',
      phone: '+60111000004',
      consent: true,
      language: 'en',
    });

    const skipped = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/messages`)
      .set('Authorization', bearer(owner))
      .send({
        leadId: (await dataSource
          .getRepository(Lead)
          .findOneOrFail({ where: { businessId, phone: '+60111000002' } })).id,
        templateId: promoApprovedId,
      })
      .expect(201);

    expect(skipped.body).toMatchObject({
      status: WhatsappMessageStatus.SKIPPED,
      error: 'Blocked before delivery: consent_missing',
    });
  });

  it('sends approved templates idempotently and tracks signed status webhooks', async () => {
    const before = metaState.calls.length;
    const sent = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/messages`)
      .set('Authorization', bearer(owner))
      .send({
        leadId: manualLeadId,
        templateId: promoApprovedId,
        idempotencyKey: 'manual-phase8-1',
      })
      .expect(201);

    const messageId = sent.body.id as string;
    const detail = await messageDetail(messageId);

    expect(detail.status).toBe(WhatsappMessageStatus.SENT);
    expect(detail.events.map((event) => event.eventType)).toContain(
      'send_success',
    );
    expect(metaState.calls.length - before).toBe(1);

    const repeated = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/messages`)
      .set('Authorization', bearer(owner))
      .send({
        leadId: manualLeadId,
        templateId: promoApprovedId,
        idempotencyKey: 'manual-phase8-1',
      })
      .expect(201);

    expect(repeated.body.id).toBe(messageId);
    expect(metaState.calls.length - before).toBe(1);

    const externalMessageId = detail.externalMessageId!;
    const now = Math.floor(Date.now() / 1000);

    await request(app.getHttpServer())
      .post(`${API}/webhooks/whatsapp/meta`)
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', 'sha256=deadbeef')
      .send(
        JSON.stringify(
          metaStatusPayload(externalMessageId, 'delivered', now),
        ),
      )
      .expect(403);

    expect((await messageDetail(messageId)).status).toBe(
      WhatsappMessageStatus.SENT,
    );

    await postMetaWebhook(
      metaStatusPayload(externalMessageId, 'delivered', now),
    ).expect(200);

    const delivered = await messageDetail(messageId);
    expect(delivered.status).toBe(WhatsappMessageStatus.DELIVERED);
    expect(delivered.deliveredAt).not.toBeNull();
    expect(delivered.events.map((event) => event.eventType)).toContain(
      'meta_delivered',
    );

    await postMetaWebhook(
      metaStatusPayload(externalMessageId, 'read', now + 5),
    ).expect(200);

    const read = await messageDetail(messageId);
    expect(read.status).toBe(WhatsappMessageStatus.READ);
    expect(read.readAt).not.toBeNull();

    // Stale events must not move the state backwards.
    await postMetaWebhook(
      metaStatusPayload(externalMessageId, 'sent', now + 9),
    ).expect(200);

    expect((await messageDetail(messageId)).status).toBe(
      WhatsappMessageStatus.READ,
    );

    // Replaying an identical status must not duplicate the timeline.
    await postMetaWebhook(
      metaStatusPayload(externalMessageId, 'delivered', now),
    ).expect(200);

    expect(await countEvents(messageId, 'meta_delivered')).toBe(1);

    await postMetaWebhook(
      metaStatusPayload('wamid.unknown.phase8', 'read', now),
    ).expect(200);

    await request(app.getHttpServer())
      .get(`${API}/webhooks/whatsapp/meta`)
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': VERIFY_TOKEN,
        'hub.challenge': 'phase8-challenge',
      })
      .expect(200)
      .expect('phase8-challenge');

    await request(app.getHttpServer())
      .get(`${API}/webhooks/whatsapp/meta`)
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong-token',
        'hub.challenge': 'phase8-challenge',
      })
      .expect(403);
  });

  it('applies inbound opt-outs, suppression and re-consent', async () => {
    stopLeadId = await createWebsiteLead({
      externalId: `web-stop-${suffix}`,
      fullName: 'Daniel Tan',
      phone: '+60111000008',
      consent: true,
      language: 'en',
    });

    await postMetaWebhook(
      metaInboundPayload('60111000008', 'STOP', 'wamid.inbound-stop'),
    ).expect(200);

    const inbound = await dataSource
      .getRepository(WhatsappMessage)
      .findOneOrFail({
        where: { idempotencyKey: 'in:wamid.inbound-stop' },
      });

    expect(inbound).toMatchObject({
      direction: WhatsappMessageDirection.INBOUND,
      status: WhatsappMessageStatus.RECEIVED,
      leadId: stopLeadId,
      fromPhone: '60111000008',
    });

    const consent = await dataSource
      .getRepository(LeadConsent)
      .findOneOrFail({ where: { businessId, leadId: stopLeadId } });

    expect(consent.status).toBe(LeadConsentStatus.DENIED);
    expect(consent.source).toBe('inbound_reply');

    const suppression = await dataSource
      .getRepository(CommunicationSuppression)
      .findOneOrFail({ where: { businessId, phoneNumber: '60111000008' } });

    expect(suppression.reason).toBe(SuppressionReason.OPT_OUT);

    const lead = await dataSource
      .getRepository(Lead)
      .findOneOrFail({ where: { id: stopLeadId } });

    expect(lead.consentStatus).toBe(LeadConsentStatus.DENIED);

    const before = metaState.calls.length;
    const blocked = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/messages`)
      .set('Authorization', bearer(owner))
      .send({ leadId: stopLeadId, templateId: promoApprovedId })
      .expect(201);

    expect(blocked.body).toMatchObject({
      status: WhatsappMessageStatus.SUPPRESSED,
      error: 'Blocked before delivery: suppressed',
    });
    expect(metaState.calls).toHaveLength(before);

    await grantConsent(stopLeadId);

    const suppressionCount = await dataSource
      .getRepository(CommunicationSuppression)
      .count({ where: { businessId, phoneNumber: '60111000008' } });

    expect(suppressionCount).toBe(0);

    const resumed = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/messages`)
      .set('Authorization', bearer(owner))
      .send({ leadId: stopLeadId, templateId: promoApprovedId })
      .expect(201);

    expect((await messageDetail(resumed.body.id)).status).toBe(
      WhatsappMessageStatus.SENT,
    );

    const manual = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/suppressions`)
      .set('Authorization', bearer(owner))
      .send({
        phoneNumber: '+60177000000',
        reason: SuppressionReason.MANUAL,
        notes: 'Requested through support',
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(
        `${API}/businesses/${businessId}/whatsapp/suppressions/${manual.body.id}`,
      )
      .set('Authorization', bearer(owner))
      .expect(204);
  });

  it('retries transient failures safely and records permanent ones', async () => {
    transientLeadId = await createWebsiteLead({
      externalId: `web-transient-${suffix}`,
      fullName: 'Farah Aziz',
      phone: '+60111000005',
      language: 'en',
    });
    await grantConsent(transientLeadId);

    const beforeTransient = metaState.calls.length;
    metaState.failures.push(
      new ProviderError('Meta WhatsApp is unavailable', 503),
      new ProviderError('Meta WhatsApp is unavailable', 503),
    );

    const transient = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/messages`)
      .set('Authorization', bearer(owner))
      .send({ leadId: transientLeadId, templateId: promoApprovedId })
      .expect(201);

    const recovered = await messageDetail(transient.body.id);
    expect(recovered.status).toBe(WhatsappMessageStatus.SENT);
    expect(recovered.attempts).toBe(3);
    expect(recovered.error).toBeNull();
    expect(metaState.calls.length - beforeTransient).toBe(3);
    expect(await countEvents(transient.body.id, 'retry_scheduled')).toBe(2);

    persistentLeadId = await createWebsiteLead({
      externalId: `web-persistent-${suffix}`,
      fullName: 'Hafiz Osman',
      phone: '+60111000006',
      language: 'en',
    });
    await grantConsent(persistentLeadId);

    metaState.failures.push(
      new ProviderError('Meta WhatsApp is unavailable', 503),
      new ProviderError('Meta WhatsApp is unavailable', 503),
      new ProviderError('Meta WhatsApp is unavailable', 503),
    );

    const persistent = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/messages`)
      .set('Authorization', bearer(owner))
      .send({ leadId: persistentLeadId, templateId: promoApprovedId })
      .expect(201);

    const failed = await messageDetail(persistent.body.id);
    expect(failed.status).toBe(WhatsappMessageStatus.FAILED);
    expect(failed.attempts).toBe(3);
    expect(failed.error).toContain('unavailable');
    expect(await countEvents(persistent.body.id, 'retry_scheduled')).toBe(2);
    expect(await countEvents(persistent.body.id, 'send_failed')).toBe(1);

    const rows = await dataSource.getRepository(WhatsappMessage).count({
      where: { businessId, leadId: persistentLeadId },
    });
    expect(rows).toBe(1);

    const retried = await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/whatsapp/messages/${persistent.body.id}/retry`,
      )
      .set('Authorization', bearer(owner))
      .expect(201);

    expect(retried.body).toMatchObject({
      id: persistent.body.id,
      status: WhatsappMessageStatus.SENT,
      attempts: 1,
      error: null,
    });

    permanentLeadId = await createWebsiteLead({
      externalId: `web-permanent-${suffix}`,
      fullName: 'Izzat Kamal',
      phone: '+60111000007',
      language: 'en',
    });
    await grantConsent(permanentLeadId);

    const beforePermanent = metaState.calls.length;
    metaState.failures.push(
      new ProviderError('Invalid template parameters', 400),
    );

    const permanent = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/messages`)
      .set('Authorization', bearer(owner))
      .send({ leadId: permanentLeadId, templateId: promoApprovedId })
      .expect(201);

    const permanentDetail = await messageDetail(permanent.body.id);
    expect(permanentDetail.status).toBe(WhatsappMessageStatus.FAILED);
    expect(permanentDetail.attempts).toBe(1);
    expect(permanentDetail.error).toContain('Invalid template parameters');
    expect(metaState.calls.length - beforePermanent).toBe(1);

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/messages/${transient.body.id}/retry`)
      .set('Authorization', bearer(owner))
      .expect(400);
  });

  it('sends Twilio template messages and accepts signed Twilio callbacks', async () => {
    const template = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/templates`)
      .set('Authorization', bearer(owner))
      .send({
        name: 'twilio_welcome',
        language: 'en',
        category: WhatsappTemplateCategory.UTILITY,
        body: 'Hello {{1}}, welcome to the Twilio sender.',
        variableMapping: { '1': 'lead.fullName' },
        accountId: twilioAccountId,
        providerTemplateId: 'HX1234567890',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/whatsapp/templates/${template.body.id}/submit`,
      )
      .set('Authorization', bearer(owner))
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/whatsapp/templates/${template.body.id}/approve`,
      )
      .set('Authorization', bearer(owner))
      .expect(201);

    twilioLeadId = await createWebsiteLead({
      externalId: `web-twilio-${suffix}`,
      fullName: 'Ivy Wong',
      phone: '+60111000009',
      language: 'en',
    });
    await grantConsent(twilioLeadId);

    const sent = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/messages`)
      .set('Authorization', bearer(owner))
      .send({
        leadId: twilioLeadId,
        templateId: template.body.id,
        accountId: twilioAccountId,
        variables: { '1': 'Ivy Wong' },
      })
      .expect(201);

    const detail = await messageDetail(sent.body.id);
    expect(detail.status).toBe(WhatsappMessageStatus.SENT);

    const call = twilioState.calls[twilioState.calls.length - 1];
    expect(call.context.credentials).toMatchObject({
      accountSid: TWILIO_SID,
      authToken: TWILIO_TOKEN,
    });
    expect(call.context.phoneNumberExternalId).toBe(TWILIO_SENDER);
    expect(call.input).toMatchObject({
      templateName: 'twilio_welcome',
      providerTemplateId: 'HX1234567890',
      language: 'en',
      toPhone: '60111000009',
      variables: { '1': 'Ivy Wong' },
    });

    const externalMessageId = detail.externalMessageId!;
    const statusParams = {
      AccountSid: TWILIO_SID,
      MessageSid: externalMessageId,
      MessageStatus: 'delivered',
      To: `whatsapp:${TWILIO_SENDER}`,
      From: 'whatsapp:+60111000009',
    };

    await request(app.getHttpServer())
      .post(`${API}/webhooks/whatsapp/twilio`)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .set('x-twilio-signature', 'not-a-valid-signature')
      .send(new URLSearchParams(statusParams).toString())
      .expect(403);

    await postTwilioWebhook(statusParams).expect(200);

    expect((await messageDetail(sent.body.id)).status).toBe(
      WhatsappMessageStatus.DELIVERED,
    );

    const inboundParams = {
      AccountSid: TWILIO_SID,
      MessageSid: 'SM-inbound-phase8-1',
      From: 'whatsapp:+60111000009',
      To: `whatsapp:${TWILIO_SENDER}`,
      Body: 'Thanks, talk soon!',
    };

    await postTwilioWebhook(inboundParams).expect(200);

    const inbound = await dataSource
      .getRepository(WhatsappMessage)
      .findOneOrFail({
        where: { idempotencyKey: 'in:SM-inbound-phase8-1' },
      });

    expect(inbound).toMatchObject({
      direction: WhatsappMessageDirection.INBOUND,
      status: WhatsappMessageStatus.RECEIVED,
      leadId: twilioLeadId,
      fromPhone: '60111000009',
    });

    await postTwilioWebhook(inboundParams).expect(200);

    const inboundCount = await dataSource
      .getRepository(WhatsappMessage)
      .count({ where: { idempotencyKey: 'in:SM-inbound-phase8-1' } });

    expect(inboundCount).toBe(1);
  });

  it('exposes paginated message history scoped to the business', async () => {
    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/whatsapp/messages`)
      .set('Authorization', bearer(stranger))
      .expect(404);

    const firstPage = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/whatsapp/messages`)
      .set('Authorization', bearer(owner))
      .query({ page: 1, pageSize: 5 })
      .expect(200);

    expect(firstPage.body.pageSize).toBe(5);
    expect(firstPage.body.items).toHaveLength(5);
    expect(firstPage.body.total).toBeGreaterThan(5);

    const failed = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/whatsapp/messages`)
      .set('Authorization', bearer(owner))
      .query({ status: WhatsappMessageStatus.FAILED })
      .expect(200);

    expect(failed.body.items.length).toBeGreaterThanOrEqual(1);
    expect(
      failed.body.items.every(
        (item: { status: string }) =>
          item.status === WhatsappMessageStatus.FAILED,
      ),
    ).toBe(true);

    const byLead = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/whatsapp/messages`)
      .set('Authorization', bearer(owner))
      .query({ leadId: twilioLeadId })
      .expect(200);

    expect(byLead.body.items.length).toBe(2);
    expect(
      byLead.body.items.every(
        (item: { leadId: string }) => item.leadId === twilioLeadId,
      ),
    ).toBe(true);

    const searched = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/whatsapp/messages`)
      .set('Authorization', bearer(owner))
      .query({ search: '111000005' })
      .expect(200);

    expect(searched.body.items.length).toBeGreaterThanOrEqual(1);
    expect(
      searched.body.items.every((item: { toPhone: string }) =>
        item.toPhone.includes('111000005'),
      ),
    ).toBe(true);

    const consents = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/whatsapp/consents`)
      .set('Authorization', bearer(owner))
      .query({ leadId: stopLeadId })
      .expect(200);

    expect(consents.body).toHaveLength(1);
    expect(consents.body[0]).toMatchObject({
      status: LeadConsentStatus.GRANTED,
      channel: 'whatsapp',
    });

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/whatsapp/messages`)
      .set('Authorization', bearer(stranger))
      .send({ leadId: englishLeadId, templateId: promoApprovedId })
      .expect(404);
  });
});
