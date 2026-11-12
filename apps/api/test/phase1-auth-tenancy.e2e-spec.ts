import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { Agency } from '../src/database/entities/agency.entity';
import { AuditLog } from '../src/database/entities/audit-log.entity';
import { Business } from '../src/database/entities/business.entity';
import { Tenant } from '../src/database/entities/tenant.entity';
import { User } from '../src/database/entities/user.entity';

const API = '/api/v1';
const PASSWORD = 'Str0ngPassw0rd!';

interface Session {
  userId: string;
  email: string;
  accessToken: string;
  refreshCookie: string;
}

const readRefreshCookie = (response: request.Response): string => {
  const header = response.headers['set-cookie'] as unknown;
  const cookies = Array.isArray(header) ? header : typeof header === 'string' ? [header] : [];
  const cookie = cookies.find((value: string) => value.startsWith('adpilot_refresh='));

  if (!cookie) {
    throw new Error('Expected a refresh cookie on the response');
  }

  return cookie.split(';')[0];
};

describe('Authentication, tenancy and permissions (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const emails = {
    owner: `e2e-owner-${suffix}@adpilot.test`,
    member: `e2e-member-${suffix}@adpilot.test`,
    reset: `e2e-reset-${suffix}@adpilot.test`,
  };

  const userIds: string[] = [];
  const businessIds: string[] = [];
  const agencyIds: string[] = [];
  const tenantIds: string[] = [];

  let owner: Session;
  let member: Session;
  let ownerBusinessId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (auditIdsCanClean()) {
      await dataSource.getRepository(AuditLog).delete({ businessId: In(businessIds) });
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

  // Guard against deleting with an empty IN() just in case setup failed early.
  const auditIdsCanClean = (): boolean => businessIds.length > 0;

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
      refreshCookie: readRefreshCookie(response),
    };
  };

  const auth = (session: Session) => `Bearer ${session.accessToken}`;

  it('registers a user and returns a session without exposing the password', async () => {
    const response = await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({
        email: emails.owner,
        password: PASSWORD,
        firstName: 'Nadia',
        lastName: 'Owner',
      })
      .expect(201);

    owner = {
      userId: response.body.user.id,
      email: emails.owner,
      accessToken: response.body.accessToken,
      refreshCookie: readRefreshCookie(response),
    };
    userIds.push(owner.userId);

    expect(response.body.user.email).toBe(emails.owner);
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
  });

  it('rejects duplicate registration and invalid payloads', async () => {
    await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({
        email: emails.owner,
        password: PASSWORD,
        firstName: 'Nadia',
        lastName: 'Duplicate',
      })
      .expect(409);

    await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({ email: 'not-an-email', password: 'short', firstName: '', lastName: '' })
      .expect(400);
  });

  it('protects authenticated endpoints by default', async () => {
    await request(app.getHttpServer()).get(`${API}/users/me`).expect(401);
    await request(app.getHttpServer()).get(`${API}/businesses/mine`).expect(401);
    await request(app.getHttpServer()).get(`${API}/health`).expect(200);
  });

  it('creates a business workspace owned by the caller', async () => {
    const response = await request(app.getHttpServer())
      .post(`${API}/businesses`)
      .set('Authorization', auth(owner))
      .send({ name: 'E2E Curtains', currency: 'MYR', timezone: 'Asia/Kuala_Lumpur' })
      .expect(201);

    ownerBusinessId = response.body.business.id;
    businessIds.push(ownerBusinessId);
    tenantIds.push(response.body.business.tenantId);

    expect(response.body.roles).toContain('business_owner');
    expect(response.body.permissions).toContain('business.manage_members');
    expect(response.body.accessType).toBe('direct');

    const mine = await request(app.getHttpServer())
      .get(`${API}/businesses/mine`)
      .set('Authorization', auth(owner))
      .expect(200);

    expect(mine.body.map((entry: { id: string }) => entry.id)).toContain(ownerBusinessId);
  });

  it('blocks cross-tenant reads and writes with a 404', async () => {
    member = await register(emails.member, 'Member', 'Two');

    await request(app.getHttpServer())
      .get(`${API}/businesses/${ownerBusinessId}`)
      .set('Authorization', auth(member))
      .expect(404);

    await request(app.getHttpServer())
      .patch(`${API}/businesses/${ownerBusinessId}`)
      .set('Authorization', auth(member))
      .send({ name: 'Hijacked' })
      .expect(404);

    await request(app.getHttpServer())
      .get(`${API}/businesses/${ownerBusinessId}/members`)
      .set('Authorization', auth(member))
      .expect(404);
  });

  it('applies viewer permissions and denies privileged actions', async () => {
    await request(app.getHttpServer())
      .post(`${API}/businesses/${ownerBusinessId}/members`)
      .set('Authorization', auth(owner))
      .send({ email: emails.member, roleKey: 'business_viewer' })
      .expect(201);

    const business = await request(app.getHttpServer())
      .get(`${API}/businesses/${ownerBusinessId}`)
      .set('Authorization', auth(member))
      .expect(200);

    expect(business.body.permissions).toContain('business.read');
    expect(business.body.permissions).not.toContain('business.update');
    expect(business.body.accessType).toBe('direct');

    await request(app.getHttpServer())
      .patch(`${API}/businesses/${ownerBusinessId}`)
      .set('Authorization', auth(member))
      .send({ name: 'Viewer edit' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`${API}/businesses/${ownerBusinessId}/members`)
      .set('Authorization', auth(member))
      .send({ email: emails.owner, roleKey: 'business_admin' })
      .expect(403);
  });

  it('allows an owner to promote a member', async () => {
    await request(app.getHttpServer())
      .patch(`${API}/businesses/${ownerBusinessId}/members/${member.userId}`)
      .set('Authorization', auth(owner))
      .send({ roleKey: 'business_admin' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`${API}/businesses/${ownerBusinessId}`)
      .set('Authorization', auth(member))
      .send({ name: 'E2E Curtains Studio' })
      .expect(200);
  });

  it('protects the last active business owner', async () => {
    await request(app.getHttpServer())
      .delete(`${API}/businesses/${ownerBusinessId}/members/${owner.userId}`)
      .set('Authorization', auth(owner))
      .expect(400);
  });

  it('removes a member and revokes their access immediately', async () => {
    await request(app.getHttpServer())
      .delete(`${API}/businesses/${ownerBusinessId}/members/${member.userId}`)
      .set('Authorization', auth(owner))
      .expect(200);

    await request(app.getHttpServer())
      .get(`${API}/businesses/${ownerBusinessId}`)
      .set('Authorization', auth(member))
      .expect(404);
  });

  it('rotates refresh tokens and rejects replayed tokens', async () => {
    const refreshed = await request(app.getHttpServer())
      .post(`${API}/auth/refresh`)
      .set('Cookie', owner.refreshCookie)
      .send({})
      .expect(200);

    const rotatedCookie = readRefreshCookie(refreshed);
    expect(rotatedCookie).not.toBe(owner.refreshCookie);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post(`${API}/auth/refresh`)
      .set('Cookie', owner.refreshCookie)
      .send({})
      .expect(401);

    await request(app.getHttpServer())
      .post(`${API}/auth/logout`)
      .set('Cookie', rotatedCookie)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .post(`${API}/auth/refresh`)
      .set('Cookie', rotatedCookie)
      .send({})
      .expect(401);
  });

  it('resets a password and invalidates the previous one', async () => {
    const resetUser = await register(emails.reset, 'Reset', 'User');

    const forgot = await request(app.getHttpServer())
      .post(`${API}/auth/forgot-password`)
      .send({ email: emails.reset })
      .expect(200);

    expect(forgot.body.resetToken).toEqual(expect.any(String));

    const newPassword = 'N3wStrongPassw0rd!';
    await request(app.getHttpServer())
      .post(`${API}/auth/reset-password`)
      .send({ token: forgot.body.resetToken, password: newPassword })
      .expect(200);

    await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: emails.reset, password: PASSWORD })
      .expect(401);

    const login = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: emails.reset, password: newPassword })
      .expect(200);

    expect(login.body.user.id).toBe(resetUser.userId);

    await request(app.getHttpServer())
      .post(`${API}/auth/forgot-password`)
      .send({ email: 'missing@adpilot.test' })
      .expect(200);
  });

  it('isolates agency-managed client workspaces', async () => {
    const agencyResponse = await request(app.getHttpServer())
      .post(`${API}/agencies`)
      .set('Authorization', auth(member))
      .send({ name: 'E2E Agency' })
      .expect(201);

    const agencyId = agencyResponse.body.agency.id;
    agencyIds.push(agencyId);
    tenantIds.push(agencyResponse.body.agency.tenantId);
    expect(agencyResponse.body.roles).toContain('agency_owner');

    const clientResponse = await request(app.getHttpServer())
      .post(`${API}/agencies/${agencyId}/clients`)
      .set('Authorization', auth(member))
      .send({ name: 'E2E Client Boutique' })
      .expect(201);

    const clientBusinessId = clientResponse.body.business.id;
    businessIds.push(clientBusinessId);
    tenantIds.push(clientResponse.body.business.tenantId);
    expect(clientResponse.body.accessType).toBe('agency');

    const clientView = await request(app.getHttpServer())
      .get(`${API}/businesses/${clientBusinessId}`)
      .set('Authorization', auth(member))
      .expect(200);

    expect(clientView.body.agencyId).toBe(agencyId);

    // The agency owner is not a direct member of the client workspace.
    const members = await request(app.getHttpServer())
      .get(`${API}/businesses/${clientBusinessId}/members`)
      .set('Authorization', auth(member))
      .expect(200);
    expect(members.body).toHaveLength(0);

    // An unrelated user cannot see the client workspace or the agency.
    await request(app.getHttpServer())
      .get(`${API}/businesses/${clientBusinessId}`)
      .set('Authorization', auth(owner))
      .expect(404);

    await request(app.getHttpServer())
      .get(`${API}/agencies/${agencyId}`)
      .set('Authorization', auth(owner))
      .expect(404);

    // Ending the relationship removes agency access while keeping the business.
    await request(app.getHttpServer())
      .delete(`${API}/agencies/${agencyId}/clients/${clientBusinessId}`)
      .set('Authorization', auth(member))
      .expect(200);

    await request(app.getHttpServer())
      .get(`${API}/businesses/${clientBusinessId}`)
      .set('Authorization', auth(member))
      .expect(404);
  });

  it('records audit entries for tenancy changes', async () => {
    const response = await request(app.getHttpServer())
      .get(`${API}/audit-logs`)
      .query({ businessId: ownerBusinessId })
      .set('Authorization', auth(owner))
      .expect(200);

    const actions = response.body.map((entry: { action: string }) => entry.action);
    expect(actions).toContain('business.created');
    expect(actions).toContain('business.member_added');
    expect(actions).toContain('business.member_removed');
  });

  it('rejects unauthenticated writes and malformed identifiers', async () => {
    await request(app.getHttpServer())
      .post(`${API}/businesses`)
      .send({ name: 'Anonymous' })
      .expect(401);

    await request(app.getHttpServer())
      .get(`${API}/businesses/not-a-real-business`)
      .set('Authorization', auth(owner))
      .expect(404);
  });
});
