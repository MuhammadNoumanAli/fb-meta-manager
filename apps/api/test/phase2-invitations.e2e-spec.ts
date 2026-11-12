import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { AgencyClient } from '../src/database/entities/agency-client.entity';
import { Agency } from '../src/database/entities/agency.entity';
import { AuditLog } from '../src/database/entities/audit-log.entity';
import { BusinessUser } from '../src/database/entities/business-user.entity';
import { Business } from '../src/database/entities/business.entity';
import { Invitation } from '../src/database/entities/invitation.entity';
import { Tenant } from '../src/database/entities/tenant.entity';
import { UserBusinessRole } from '../src/database/entities/user-business-role.entity';
import { User } from '../src/database/entities/user.entity';

const API = '/api/v1';
const PASSWORD = 'Str0ngPassw0rd!';

interface Session {
  userId: string;
  email: string;
  accessToken: string;
}

describe('Agency client onboarding and invitations (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const emails = {
    owner: `phase2-owner-${suffix}@adpilot.test`,
    outsider: `phase2-outsider-${suffix}@adpilot.test`,
    newClient: `phase2-client-new-${suffix}@adpilot.test`,
    existingClient: `phase2-client-existing-${suffix}@adpilot.test`,
    expiredClient: `phase2-client-expired-${suffix}@adpilot.test`,
    revokedClient: `phase2-client-revoked-${suffix}@adpilot.test`,
    validationClient: `phase2-client-validation-${suffix}@adpilot.test`,
  };

  const userIds: string[] = [];
  const businessIds: string[] = [];
  const agencyIds: string[] = [];
  const tenantIds: string[] = [];
  const invitationIds: string[] = [];

  let owner: Session;
  let outsider: Session;
  let agencyId: string;
  let clientBusinessId: string;

  let newClient: Session;
  let existingClient: Session;

  let pendingToken: string;
  let pendingInvitationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();

    dataSource = app.get(DataSource);

    owner = await register(emails.owner, 'Nora', 'Owner');
    outsider = await register(emails.outsider, 'Oscar', 'Outsider');

    const agencyResponse = await request(app.getHttpServer())
      .post(`${API}/agencies`)
      .set('Authorization', bearer(owner))
      .send({ name: 'Phase Two E2E Agency' })
      .expect(201);

    agencyId = agencyResponse.body.agency.id;
    agencyIds.push(agencyId);
    tenantIds.push(agencyResponse.body.agency.tenantId);

    const clientResponse = await request(app.getHttpServer())
      .post(`${API}/agencies/${agencyId}/clients`)
      .set('Authorization', bearer(owner))
      .send({ name: 'Phase Two E2E Boutique' })
      .expect(201);

    clientBusinessId = clientResponse.body.business.id;
    businessIds.push(clientBusinessId);
    tenantIds.push(clientResponse.body.business.tenantId);
  });

  afterAll(async () => {
    if (businessIds.length > 0) {
      await dataSource.getRepository(AuditLog).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(Invitation).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(UserBusinessRole).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(BusinessUser).delete({ businessId: In(businessIds) });
    }

    if (agencyIds.length > 0) {
      await dataSource.getRepository(AgencyClient).delete({ agencyId: In(agencyIds) });
    }

    if (userIds.length > 0) {
      await dataSource.getRepository(User).delete({ id: In(userIds) });
    }

    if (businessIds.length > 0) {
      await dataSource.getRepository(Business).delete({ id: In(businessIds) });
    }

    if (agencyIds.length > 0) {
      await dataSource.getRepository(Agency).delete({ id: In(agencyIds) });
    }

    if (tenantIds.length > 0) {
      await dataSource.getRepository(Tenant).delete({ id: In(tenantIds) });
    }

    await app.close();
  });

  const bearer = (session: Session) => `Bearer ${session.accessToken}`;

  const register = async (
    email: string,
    firstName: string,
    lastName: string,
  ): Promise<Session> => {
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
  };

  const createInvitation = async (
    email: string,
    expiresInDays?: number,
  ): Promise<{ id: string; token: string }> => {
    const response = await request(app.getHttpServer())
      .post(`${API}/agencies/${agencyId}/clients/${clientBusinessId}/invitations`)
      .set('Authorization', bearer(owner))
      .send({
        email,
        ...(expiresInDays === undefined ? {} : { expiresInDays }),
      })
      .expect(201);

    invitationIds.push(response.body.id);

    return { id: response.body.id, token: response.body.token };
  };

  it('creates a secure invitation with an acceptance link and expiry', async () => {
    const before = Date.now();

    const response = await request(app.getHttpServer())
      .post(`${API}/agencies/${agencyId}/clients/${clientBusinessId}/invitations`)
      .set('Authorization', bearer(owner))
      .send({ email: emails.newClient, expiresInDays: 5 })
      .expect(201);

    pendingInvitationId = response.body.id;
    pendingToken = response.body.token;
    invitationIds.push(pendingInvitationId);

    expect(response.body.status).toBe('pending');
    expect(response.body.email).toBe(emails.newClient);
    expect(response.body.token).toHaveLength(64);
    expect(response.body.acceptanceUrl).toContain(`/invitations/${pendingToken}`);

    const expiresAt = new Date(response.body.expiresAt).getTime();
    const days = (expiresAt - before) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(4.9);
    expect(days).toBeLessThan(5.1);

    const list = await request(app.getHttpServer())
      .get(`${API}/agencies/${agencyId}/clients/${clientBusinessId}/invitations`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(pendingInvitationId);
    expect(list.body[0].status).toBe('pending');
  });

  it('supersedes earlier pending invitations for the same client email', async () => {
    const replacement = await request(app.getHttpServer())
      .post(`${API}/agencies/${agencyId}/clients/${clientBusinessId}/invitations`)
      .set('Authorization', bearer(owner))
      .send({ email: emails.newClient })
      .expect(201);

    invitationIds.push(replacement.body.id);

    expect(replacement.body.token).not.toBe(pendingToken);

    const list = await request(app.getHttpServer())
      .get(`${API}/agencies/${agencyId}/clients/${clientBusinessId}/invitations`)
      .set('Authorization', bearer(owner))
      .expect(200);

    const previous = list.body.find(
      (entry: { id: string }) => entry.id === pendingInvitationId,
    );
    expect(previous.status).toBe('revoked');

    const current = list.body.find(
      (entry: { id: string }) => entry.id === replacement.body.id,
    );
    expect(current.status).toBe('pending');
    // Listing never exposes the token again; only creation returns the link.
    expect(current.acceptanceUrl).toBeUndefined();

    await request(app.getHttpServer())
      .get(`${API}/invitations/${pendingToken}`)
      .expect(410);

    pendingToken = replacement.body.token;
    pendingInvitationId = replacement.body.id;
  });

  it('serves the invitation preview publicly and hides unknown tokens', async () => {
    const preview = await request(app.getHttpServer())
      .get(`${API}/invitations/${pendingToken}`)
      .expect(200);

    expect(preview.body.email).toBe(emails.newClient);
    expect(preview.body.agencyName).toBe('Phase Two E2E Agency');
    expect(preview.body.businessName).toBe('Phase Two E2E Boutique');
    expect(preview.body.hasAccount).toBe(false);
    expect(preview.body).not.toHaveProperty('token');

    await request(app.getHttpServer())
      .get(`${API}/invitations/${'0'.repeat(64)}`)
      .expect(404);
  });

  it('validates invitations and isolates agencies from each other', async () => {
    await request(app.getHttpServer())
      .post(`${API}/agencies/${agencyId}/clients/${clientBusinessId}/invitations`)
      .set('Authorization', bearer(owner))
      .send({ email: 'not-an-email' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`${API}/agencies/${agencyId}/clients/${clientBusinessId}/invitations`)
      .set('Authorization', bearer(owner))
      .send({ email: emails.validationClient, expiresInDays: 0 })
      .expect(400);

    await request(app.getHttpServer())
      .post(`${API}/agencies/${agencyId}/clients/${clientBusinessId}/invitations`)
      .set('Authorization', bearer(owner))
      .send({ email: emails.validationClient, expiresInDays: 31 })
      .expect(400);

    await request(app.getHttpServer())
      .post(`${API}/agencies/${agencyId}/clients/${clientBusinessId}/invitations`)
      .set('Authorization', bearer(outsider))
      .send({ email: emails.validationClient })
      .expect(404);

    await request(app.getHttpServer())
      .get(`${API}/agencies/${agencyId}/clients/${clientBusinessId}/invitations`)
      .set('Authorization', bearer(outsider))
      .expect(404);
  });

  it('accepts a new-account invitation and applies onboarding settings', async () => {
    const accepted = await request(app.getHttpServer())
      .post(`${API}/invitations/${pendingToken}/accept`)
      .send({
        firstName: 'Chloe',
        lastName: 'Tan',
        password: PASSWORD,
        currency: 'USD',
        timezone: 'America/New_York',
        industry: 'Retail',
        description: 'Independent retail brand onboarded by invitation.',
        website: 'https://boutique.example.com',
        contactEmail: 'Owner@Boutique.example.com',
        contactPhone: '+1 555 0100',
      })
      .expect(200);

    userIds.push(accepted.body.user.id);
    expect(accepted.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(accepted.body.user.email).toBe(emails.newClient);
    expect(accepted.body.user).not.toHaveProperty('passwordHash');
    expect(accepted.body.businessId).toBe(clientBusinessId);

    newClient = {
      userId: accepted.body.user.id,
      email: emails.newClient,
      accessToken: accepted.body.accessToken,
    };

    const detail = await request(app.getHttpServer())
      .get(`${API}/businesses/${clientBusinessId}`)
      .set('Authorization', bearer(newClient))
      .expect(200);

    expect(detail.body.accessType).toBe('direct');
    expect(detail.body.roles).toContain('business_owner');
    expect(detail.body.permissions).toContain('business.update');
    expect(detail.body.business.currency).toBe('USD');
    expect(detail.body.business.timezone).toBe('America/New_York');
    expect(detail.body.business.industry).toBe('Retail');
    expect(detail.body.business.website).toBe('https://boutique.example.com');
    expect(detail.body.business.contactEmail).toBe('owner@boutique.example.com');
    expect(detail.body.business.contactPhone).toBe('+1 555 0100');

    const members = await request(app.getHttpServer())
      .get(`${API}/businesses/${clientBusinessId}/members`)
      .set('Authorization', bearer(newClient))
      .expect(200);

    expect(members.body).toHaveLength(1);
    expect(members.body[0].roles).toContain('business_owner');

    await request(app.getHttpServer())
      .post(`${API}/invitations/${pendingToken}/accept`)
      .send({ password: PASSWORD })
      .expect(410);

    await request(app.getHttpServer())
      .get(`${API}/invitations/${pendingToken}`)
      .expect(410);
  });

  it('requires the existing account password instead of duplicating accounts', async () => {
    existingClient = await register(emails.existingClient, 'Existing', 'Client');

    const invitation = await createInvitation(emails.existingClient);

    const preview = await request(app.getHttpServer())
      .get(`${API}/invitations/${invitation.token}`)
      .expect(200);
    expect(preview.body.hasAccount).toBe(true);

    await request(app.getHttpServer())
      .post(`${API}/invitations/${invitation.token}/accept`)
      .send({ password: 'Wr0ng-Password-1' })
      .expect(401);

    const accepted = await request(app.getHttpServer())
      .post(`${API}/invitations/${invitation.token}/accept`)
      .send({ password: PASSWORD })
      .expect(200);

    expect(accepted.body.user.id).toBe(existingClient.userId);
    expect(accepted.body.businessId).toBe(clientBusinessId);

    const detail = await request(app.getHttpServer())
      .get(`${API}/businesses/${clientBusinessId}`)
      .set('Authorization', bearer(existingClient))
      .expect(200);

    expect(detail.body.accessType).toBe('direct');
    expect(detail.body.roles).toContain('business_owner');
    // Existing members do not overwrite the workspace configuration.
    expect(detail.body.business.currency).toBe('USD');
    expect(detail.body.business.timezone).toBe('America/New_York');
  });

  it('expires invitations so expired links cannot be accepted', async () => {
    const invitation = await createInvitation(emails.expiredClient);

    await dataSource
      .getRepository(Invitation)
      .update(invitation.id, { expiresAt: new Date(Date.now() - 60_000) });

    const preview = await request(app.getHttpServer())
      .get(`${API}/invitations/${invitation.token}`)
      .expect(410);
    expect(preview.body.message).toContain('expired');

    const list = await request(app.getHttpServer())
      .get(`${API}/agencies/${agencyId}/clients/${clientBusinessId}/invitations`)
      .set('Authorization', bearer(owner))
      .expect(200);

    const entry = list.body.find(
      (row: { id: string }) => row.id === invitation.id,
    );
    expect(entry.status).toBe('expired');

    await request(app.getHttpServer())
      .post(`${API}/invitations/${invitation.token}/accept`)
      .send({ firstName: 'Expired', lastName: 'Client', password: PASSWORD })
      .expect(410);
  });

  it('revokes pending invitations and rejects replay', async () => {
    const invitation = await createInvitation(emails.revokedClient);

    const revoked = await request(app.getHttpServer())
      .delete(
        `${API}/agencies/${agencyId}/clients/${clientBusinessId}/invitations/${invitation.id}`,
      )
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(revoked.body.status).toBe('revoked');

    await request(app.getHttpServer())
      .get(`${API}/invitations/${invitation.token}`)
      .expect(410);

    await request(app.getHttpServer())
      .delete(
        `${API}/agencies/${agencyId}/clients/${clientBusinessId}/invitations/${invitation.id}`,
      )
      .set('Authorization', bearer(owner))
      .expect(400);

    await request(app.getHttpServer())
      .delete(
        `${API}/agencies/${agencyId}/clients/${clientBusinessId}/invitations/00000000-0000-0000-0000-000000000000`,
      )
      .set('Authorization', bearer(owner))
      .expect(404);

    await request(app.getHttpServer())
      .post(`${API}/invitations/${invitation.token}/accept`)
      .send({ firstName: 'Revoked', lastName: 'Client', password: PASSWORD })
      .expect(410);
  });

  it('rejects invalid acceptance payloads', async () => {
    const invitation = await createInvitation(emails.validationClient);

    await request(app.getHttpServer())
      .post(`${API}/invitations/${invitation.token}/accept`)
      .send({ firstName: 'Bad', lastName: 'Payload', password: 'short' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`${API}/invitations/${invitation.token}/accept`)
      .send({ password: PASSWORD })
      .expect(400);

    await request(app.getHttpServer())
      .post(`${API}/invitations/${'f'.repeat(64)}/accept`)
      .send({ firstName: 'Missing', lastName: 'Invitation', password: PASSWORD })
      .expect(404);
  });

  it('records invitation audit entries', async () => {
    const response = await request(app.getHttpServer())
      .get(`${API}/audit-logs`)
      .query({ businessId: clientBusinessId })
      .set('Authorization', bearer(newClient))
      .expect(200);

    const actions = response.body.map((entry: { action: string }) => entry.action);
    expect(actions).toContain('invitation.created');
    expect(actions).toContain('invitation.accepted');
    expect(actions).toContain('invitation.revoked');
  });

  it('preserves client ownership when the agency relationship ends', async () => {
    await request(app.getHttpServer())
      .delete(`${API}/agencies/${agencyId}/clients/${clientBusinessId}`)
      .set('Authorization', bearer(owner))
      .expect(200);

    await request(app.getHttpServer())
      .get(`${API}/businesses/${clientBusinessId}`)
      .set('Authorization', bearer(owner))
      .expect(404);

    const ownerView = await request(app.getHttpServer())
      .get(`${API}/businesses/${clientBusinessId}`)
      .set('Authorization', bearer(newClient))
      .expect(200);

    expect(ownerView.body.accessType).toBe('direct');
    expect(ownerView.body.roles).toContain('business_owner');

    const updated = await request(app.getHttpServer())
      .patch(`${API}/businesses/${clientBusinessId}`)
      .set('Authorization', bearer(newClient))
      .send({
        name: 'Phase Two E2E Boutique Studio',
        industry: 'Specialty retail',
        contactEmail: 'OWNER@Boutique.example.com',
        contactPhone: '+1 555 0199',
      })
      .expect(200);

    expect(updated.body.business.name).toBe('Phase Two E2E Boutique Studio');
    expect(updated.body.business.industry).toBe('Specialty retail');
    expect(updated.body.business.contactEmail).toBe('owner@boutique.example.com');
    expect(updated.body.business.contactPhone).toBe('+1 555 0199');

    // The agency workspace itself remains intact for its own members.
    await request(app.getHttpServer())
      .get(`${API}/agencies/${agencyId}`)
      .set('Authorization', bearer(owner))
      .expect(200);
  });
});
