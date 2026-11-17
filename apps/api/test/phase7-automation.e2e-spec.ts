import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import request from 'supertest';
import { DataSource, In, Like } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { AdvertisingObjective } from '../src/common/enums/advertising-objective.enum';
import { AdvertisingStatus } from '../src/common/enums/advertising-status.enum';
import { ApprovalDecision } from '../src/common/enums/approval-decision.enum';
import { ApprovalTargetType } from '../src/common/enums/approval-target-type.enum';
import { AutomationActionType } from '../src/common/enums/automation-action-type.enum';
import { AutomationExecutionStatus } from '../src/common/enums/automation-execution-status.enum';
import { AutomationTriggerType } from '../src/common/enums/automation-trigger-type.enum';
import { BulkOperationStatus } from '../src/common/enums/bulk-operation-status.enum';
import { BulkOperationType } from '../src/common/enums/bulk-operation-type.enum';
import { IntegrationConnectionMode } from '../src/common/enums/integration-connection-mode.enum';
import { IntegrationStatus } from '../src/common/enums/integration-status.enum';
import { MetaReviewStatus } from '../src/common/enums/meta-review-status.enum';
import { RoleScope } from '../src/common/enums/role-scope.enum';
import { ScheduledActionStatus } from '../src/common/enums/scheduled-action-status.enum';
import { ApprovalPolicy } from '../src/database/entities/approval-policy.entity';
import { ApprovalRequest } from '../src/database/entities/approval-request.entity';
import { AuditLog } from '../src/database/entities/audit-log.entity';
import { AutomationExecution } from '../src/database/entities/automation-execution.entity';
import { AutomationRule } from '../src/database/entities/automation-rule.entity';
import { BulkOperation } from '../src/database/entities/bulk-operation.entity';
import { BusinessUser } from '../src/database/entities/business-user.entity';
import { Business } from '../src/database/entities/business.entity';
import { Campaign } from '../src/database/entities/campaign.entity';
import { ExecutionLock } from '../src/database/entities/execution-lock.entity';
import { IntegrationAuthorization } from '../src/database/entities/integration-authorization.entity';
import { MetaAdAccount } from '../src/database/entities/meta-ad-account.entity';
import { Permission } from '../src/database/entities/permission.entity';
import { RolePermission } from '../src/database/entities/role-permission.entity';
import { Role } from '../src/database/entities/role.entity';
import { ScheduledAction } from '../src/database/entities/scheduled-action.entity';
import { Tenant } from '../src/database/entities/tenant.entity';
import { UserBusinessRole } from '../src/database/entities/user-business-role.entity';
import { User } from '../src/database/entities/user.entity';
import { AutomationQueueService } from '../src/modules/automation/automation-queue.service';
import { AutomationRunnerService } from '../src/modules/automation/automation-runner.service';
import { BulkOperationQueueService } from '../src/modules/automation/bulk-operation-queue.service';
import { BulkOperationsService } from '../src/modules/automation/bulk-operations.service';
import { IntegrationCryptoService } from '../src/modules/integrations/integration-crypto.service';
import { MetaGraphClient, MetaGraphError } from '../src/modules/integrations/meta-graph.client';
import { TokenMonitoringProcessor } from '../src/modules/integrations/token-monitoring.processor';

const API = '/api/v1';
const PASSWORD = 'Str0ngPassw0rd!';
const ACCESS_TOKEN = 'EAAG-phase7-secret-access-token';
const ACCOUNT_ID = 'act-phase7-100';
const REQUESTER_ROLE_KEY_PREFIX = 'phase7_requester';
const REQUESTER_PERMISSIONS = [
  'business.read',
  'campaign.read',
  'campaign.update',
  'approval.request',
];

jest.setTimeout(90_000);

interface Session {
  userId: string;
  email: string;
  accessToken: string;
}

describe('Automation and reliability (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let runner: AutomationRunnerService;

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const ownerEmail = `phase7-owner-${suffix}@adpilot.test`;
  const requesterEmail = `phase7-requester-${suffix}@adpilot.test`;
  const strangerEmail = `phase7-stranger-${suffix}@adpilot.test`;
  const requesterRoleKey = `${REQUESTER_ROLE_KEY_PREFIX}_${suffix}`;

  const userIds: string[] = [];
  const businessIds: string[] = [];
  const tenantIds: string[] = [];
  const deadLetters: Array<Record<string, unknown>> = [];
  let requesterRoleId = '';

  let owner: Session;
  let requester: Session;
  let stranger: Session;
  let businessId: string;

  let scheduledCampaignId = '';
  let ruleCampaignId = '';
  let eventCampaignId = '';
  let approvalCampaignId = '';
  let deadCampaignId = '';
  let bulkSuccessCampaignId = '';
  let bulkFailureCampaignId = '';
  let bulkApprovalCampaignAId = '';
  let bulkApprovalCampaignBId = '';

  const graphState = {
    updates: [] as Array<{ externalId: string; fields: Record<string, unknown> }>,
    failures: new Map<string, Error>(),
  };

  const graphMock = {
    updateAdvertisingEntity: async (
      _token: string,
      externalId: string,
      fields: Record<string, unknown>,
    ): Promise<void> => {
      const failure = graphState.failures.get(externalId);

      if (failure) {
        throw failure;
      }

      graphState.updates.push({ externalId, fields });
    },
    debugToken: async () => ({
      isValid: true,
      appId: 'app-phase7',
      userId: 'meta-user-phase7',
      userName: 'Phase Seven',
      scopes: ['ads_management'],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      errorCode: null,
      errorMessage: null,
    }),
  };

  // Queue producers are replaced with synchronous runners so assertions never
  // race a BullMQ worker. The real processor wiring is covered by compilation.
  const automationQueueMock = {
    enqueueExecution: async (executionId: string) => {
      await runner.runPending(executionId);
    },
    enqueueDispatch: async () => undefined,
    registerDispatchRepeatable: async () => undefined,
    moveToDeadLetter: async (job: Record<string, unknown>) => {
      deadLetters.push(job);
    },
  };

  const bulkQueueMock = {
    enqueueOperation: async (operationId: string) => {
      await app.get(BulkOperationsService).process(operationId);
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MetaGraphClient)
      .useValue(graphMock)
      .overrideProvider(AutomationQueueService)
      .useValue(automationQueueMock)
      .overrideProvider(BulkOperationQueueService)
      .useValue(bulkQueueMock)
      .compile();

    app = moduleFixture.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();

    dataSource = app.get(DataSource);
    runner = app.get(AutomationRunnerService);

    owner = await register(ownerEmail, 'Owen', 'Owner');
    requester = await register(requesterEmail, 'Rae', 'Requester');
    stranger = await register(strangerEmail, 'Sid', 'Stranger');

    await seedRequesterRole();
    businessId = await createBusiness('Phase Seven Automation');
    await seedMetaIntegration();

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/members`)
      .set('Authorization', bearer(owner))
      .send({ email: requesterEmail, roleKey: requesterRoleKey })
      .expect(201);

    scheduledCampaignId = (await createCampaign('Scheduled target')).id;
    ruleCampaignId = (await createCampaign('Scheduled rule target')).id;
    eventCampaignId = (await createCampaign('Rejected event target')).id;
    approvalCampaignId = (await createCampaign('Approval target')).id;
    deadCampaignId = (await createCampaign('Dead letter target')).id;
    bulkSuccessCampaignId = (await createCampaign('Bulk success target')).id;
    bulkFailureCampaignId = (await createCampaign('Bulk failure target')).id;
    bulkApprovalCampaignAId = (await createCampaign('Bulk approval A')).id;
    bulkApprovalCampaignBId = (await createCampaign('Bulk approval B')).id;

    await setExternalId(deadCampaignId, `ext-dead-${suffix}`);
    await setExternalId(bulkSuccessCampaignId, `ext-bulk-a-${suffix}`);
    await setExternalId(bulkFailureCampaignId, `ext-bulk-b-${suffix}`);
  });

  afterAll(async () => {
    if (businessIds.length > 0) {
      await dataSource
        .getRepository(BulkOperation)
        .delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(AutomationExecution)
        .delete({ businessId: In(businessIds) });
      await dataSource
        .getRepository(ScheduledAction)
        .delete({ businessId: In(businessIds) });
      await dataSource.getRepository(AutomationRule).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(ApprovalRequest).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(ApprovalPolicy).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(Campaign).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(AuditLog).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(UserBusinessRole).delete({ businessId: In(businessIds) });
      await dataSource.getRepository(BusinessUser).delete({ businessId: In(businessIds) });
    }

    await dataSource
      .getRepository(ExecutionLock)
      .delete({ lockKey: Like('automation-execution:%') });
    await dataSource.getRepository(ExecutionLock).delete({ lockKey: Like('bulk-operation:%') });

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
        key: requesterRoleKey,
        name: 'Phase 7 Requester',
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
        name: 'Phase Seven Ad Account',
        accountStatus: 1,
        currency: 'MYR',
        timezoneName: 'Asia/Kuala_Lumpur',
      }),
    );
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
        dailyBudget: 25,
        specialAdCategories: [],
      })
      .expect(201);

    return response.body;
  }

  async function setExternalId(campaignId: string, externalId: string): Promise<void> {
    await dataSource.getRepository(Campaign).update(campaignId, { externalId });
  }

  async function campaignStatus(campaignId: string): Promise<AdvertisingStatus> {
    const campaign = await dataSource
      .getRepository(Campaign)
      .findOneOrFail({ where: { id: campaignId } });

    return campaign.status;
  }

  async function enablePolicy(targetType: ApprovalTargetType): Promise<void> {
    await request(app.getHttpServer())
      .patch(`${API}/businesses/${businessId}/approvals/policies/${targetType}`)
      .set('Authorization', bearer(owner))
      .send({ isEnabled: true })
      .expect(200);
  }

  async function createRule(
    payload: Record<string, unknown>,
    session: Session = owner,
  ): Promise<Record<string, any>> {
    const response = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/automation/rules`)
      .set('Authorization', bearer(session))
      .send(payload)
      .expect(201);

    return response.body;
  }

  async function dispatch(): Promise<Record<string, any>> {
    const response = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/automation/dispatch`)
      .set('Authorization', bearer(owner))
      .expect(200);

    return response.body;
  }

  async function listExecutions(query = ''): Promise<Record<string, any>> {
    const response = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/automation/executions${query}`)
      .set('Authorization', bearer(owner))
      .expect(200);

    return response.body;
  }

  async function getExecution(executionId: string): Promise<Record<string, any>> {
    const response = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/automation/executions/${executionId}`)
      .set('Authorization', bearer(owner))
      .expect(200);

    return response.body;
  }

  it('enforces authentication, tenant isolation and rule validation', async () => {
    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/automation/rules`)
      .expect(401);

    await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/automation/rules`)
      .set('Authorization', bearer(stranger))
      .expect(404);

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/automation/rules`)
      .set('Authorization', bearer(owner))
      .send({
        name: 'No schedule trigger',
        triggerType: AutomationTriggerType.SCHEDULE,
        actionType: AutomationActionType.NOTIFY,
        notifyMessage: 'Missing run configuration',
      })
      .expect(400);
  });

  it('executes a scheduled action once and ignores duplicate dispatches', async () => {
    const response = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/automation/scheduled-actions`)
      .set('Authorization', bearer(owner))
      .send({
        campaignId: scheduledCampaignId,
        actionType: AutomationActionType.PAUSE_CAMPAIGN,
        runAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .expect(201);
    const actionId = response.body.id as string;

    expect(response.body.status).toBe(ScheduledActionStatus.SCHEDULED);

    await dataSource
      .getRepository(ScheduledAction)
      .update(actionId, { runAt: new Date(Date.now() - 60 * 1000) });

    const first = await dispatch();
    expect(first.scheduledActions).toBe(1);
    expect(first.executions).toBeGreaterThanOrEqual(1);
    expect(await campaignStatus(scheduledCampaignId)).toBe(AdvertisingStatus.PAUSED);

    const action = await dataSource
      .getRepository(ScheduledAction)
      .findOneOrFail({ where: { id: actionId } });
    expect(action.status).toBe(ScheduledActionStatus.EXECUTED);

    const second = await dispatch();
    expect(second.scheduledActions).toBe(0);

    const executions = await dataSource
      .getRepository(AutomationExecution)
      .count({ where: { scheduledActionId: actionId } });
    expect(executions).toBe(1);
  });

  it('runs a one-off schedule rule once and records execution history', async () => {
    const rule = await createRule({
      name: 'Pause scheduled rule',
      triggerType: AutomationTriggerType.SCHEDULE,
      actionType: AutomationActionType.PAUSE_CAMPAIGN,
      campaignId: ruleCampaignId,
      runAt: new Date(Date.now() - 60 * 1000).toISOString(),
    });

    const first = await dispatch();
    expect(first.scheduledRules).toBeGreaterThanOrEqual(1);
    expect(await campaignStatus(ruleCampaignId)).toBe(AdvertisingStatus.PAUSED);

    const history = await listExecutions(`?ruleId=${rule.id}`);
    expect(history.total).toBe(1);
    expect(history.items[0]).toMatchObject({
      ruleId: rule.id,
      ruleName: 'Pause scheduled rule',
      status: AutomationExecutionStatus.SUCCEEDED,
    });
    expect(history.items[0].result).toMatchObject({ action: 'pause_campaign' });

    await dispatch();
    const after = await listExecutions(`?ruleId=${rule.id}`);
    expect(after.total).toBe(1);
  });

  it('fires a rejected-campaign event rule once per campaign per day', async () => {
    const rule = await createRule({
      name: 'Pause rejected campaign',
      triggerType: AutomationTriggerType.CAMPAIGN_REJECTED,
      actionType: AutomationActionType.PAUSE_CAMPAIGN,
      campaignId: eventCampaignId,
    });

    await dataSource
      .getRepository(Campaign)
      .update(eventCampaignId, { metaReviewStatus: MetaReviewStatus.REJECTED });

    const first = await dispatch();
    expect(first.eventRules).toBeGreaterThanOrEqual(1);
    expect(await campaignStatus(eventCampaignId)).toBe(AdvertisingStatus.PAUSED);

    await dispatch();
    const history = await listExecutions(`?ruleId=${rule.id}`);
    expect(history.total).toBe(1);
    expect(history.items[0].trigger).toBe('event');
  });

  it('holds a requester automation for approval and executes it after approval', async () => {
    await enablePolicy(ApprovalTargetType.AUTOMATION_ACTION);

    const rule = await createRule(
      {
        name: 'Requester pause',
        triggerType: AutomationTriggerType.SCHEDULE,
        actionType: AutomationActionType.PAUSE_CAMPAIGN,
        campaignId: approvalCampaignId,
        runAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      requester,
    );

    const run = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/automation/rules/${rule.id}/run`)
      .set('Authorization', bearer(requester))
      .expect(202);

    const executionId = run.body.executionId as string;
    const pending = await getExecution(executionId);
    expect(pending.status).toBe(AutomationExecutionStatus.PENDING_APPROVAL);
    expect(pending.approvalRequestId).toBeTruthy();
    expect(await campaignStatus(approvalCampaignId)).toBe(AdvertisingStatus.DRAFT);

    const approvals = await request(app.getHttpServer())
      .get(
        `${API}/businesses/${businessId}/approvals?targetType=${ApprovalTargetType.AUTOMATION_ACTION}`,
      )
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(approvals.body.total).toBe(1);
    expect(approvals.body.items[0]).toMatchObject({
      targetId: executionId,
      status: 'pending',
      targetLabel: 'Requester pause',
    });

    await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/approvals/${pending.approvalRequestId}/decision`)
      .set('Authorization', bearer(owner))
      .send({ decision: ApprovalDecision.APPROVED })
      .expect(200);

    const executed = await getExecution(executionId);
    expect(executed.status).toBe(AutomationExecutionStatus.SUCCEEDED);
    expect(await campaignStatus(approvalCampaignId)).toBe(AdvertisingStatus.PAUSED);
  });

  it('retries transient Meta failures and moves exhausted work to the dead letter queue', async () => {
    graphState.failures.set(
      `ext-dead-${suffix}`,
      new MetaGraphError('Meta rate limit reached', 429, 17),
    );

    const rule = await createRule({
      name: 'Dead letter pause',
      triggerType: AutomationTriggerType.SCHEDULE,
      actionType: AutomationActionType.PAUSE_CAMPAIGN,
      campaignId: deadCampaignId,
      runAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    const run = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/automation/rules/${rule.id}/run`)
      .set('Authorization', bearer(owner))
      .expect(202);

    const executionId = run.body.executionId as string;
    const firstAttempt = await getExecution(executionId);
    expect(firstAttempt.status).toBe(AutomationExecutionStatus.PENDING);
    expect(firstAttempt.attempts).toBe(1);

    await runner.runPending(executionId);
    await runner.runPending(executionId);

    const exhausted = await getExecution(executionId);
    expect(exhausted.status).toBe(AutomationExecutionStatus.DEAD_LETTER);
    expect(exhausted.attempts).toBe(3);
    expect(exhausted.error).toContain('rate limit');
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0]).toMatchObject({
      sourceQueue: 'automation-execution',
      payload: { executionId },
    });
    expect(await campaignStatus(deadCampaignId)).toBe(AdvertisingStatus.DRAFT);

    graphState.failures.clear();
  });

  it('reports a partial bulk failure and retries only failed items', async () => {
    graphState.failures.set(
      `ext-bulk-b-${suffix}`,
      new MetaGraphError('Invalid campaign configuration', 400, 100),
    );

    const response = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/bulk-operations`)
      .set('Authorization', bearer(owner))
      .send({
        operation: BulkOperationType.PAUSE_CAMPAIGNS,
        campaignIds: [bulkSuccessCampaignId, bulkFailureCampaignId],
        reason: 'Phase 7 partial failure check',
      })
      .expect(201);

    expect(response.body.approvalRequired).toBe(false);
    expect(response.body.operation).toMatchObject({
      status: BulkOperationStatus.PARTIAL,
      total: 2,
      succeeded: 1,
      failed: 1,
      pending: 0,
    });

    const failedItem = response.body.operation.items.find(
      (item: Record<string, any>) => item.campaignId === bulkFailureCampaignId,
    );
    const succeededItem = response.body.operation.items.find(
      (item: Record<string, any>) => item.campaignId === bulkSuccessCampaignId,
    );

    expect(failedItem).toMatchObject({ status: 'failed', attempts: 1 });
    expect(failedItem.error).toContain('Invalid campaign configuration');
    expect(succeededItem).toMatchObject({ status: 'succeeded', attempts: 1 });
    expect(await campaignStatus(bulkSuccessCampaignId)).toBe(AdvertisingStatus.PAUSED);
    expect(await campaignStatus(bulkFailureCampaignId)).toBe(AdvertisingStatus.DRAFT);

    graphState.failures.clear();

    const retry = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/bulk-operations/${response.body.operation.id}/retry`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(retry.body).toMatchObject({
      status: BulkOperationStatus.COMPLETED,
      succeeded: 2,
      failed: 0,
      pending: 0,
    });

    const retriedSuccess = retry.body.items.find(
      (item: Record<string, any>) => item.campaignId === bulkSuccessCampaignId,
    );
    const retriedFailure = retry.body.items.find(
      (item: Record<string, any>) => item.campaignId === bulkFailureCampaignId,
    );

    // The successful item was not re-run; only the failed item is retried.
    expect(retriedSuccess.attempts).toBe(1);
    expect(retriedFailure.attempts).toBe(2);
    expect(await campaignStatus(bulkFailureCampaignId)).toBe(AdvertisingStatus.PAUSED);
  });

  it('gates bulk operations through the approval policy', async () => {
    await enablePolicy(ApprovalTargetType.BULK_OPERATION);

    const response = await request(app.getHttpServer())
      .post(`${API}/businesses/${businessId}/bulk-operations`)
      .set('Authorization', bearer(requester))
      .send({
        operation: BulkOperationType.PAUSE_CAMPAIGNS,
        campaignIds: [bulkApprovalCampaignAId, bulkApprovalCampaignBId],
        reason: 'Bulk approval check',
      })
      .expect(201);

    expect(response.body.approvalRequired).toBe(true);
    expect(response.body.approval).toMatchObject({
      targetType: ApprovalTargetType.BULK_OPERATION,
      status: 'pending',
    });
    expect(response.body.operation).toMatchObject({
      status: BulkOperationStatus.QUEUED,
      pending: 2,
    });
    expect(await campaignStatus(bulkApprovalCampaignAId)).toBe(AdvertisingStatus.DRAFT);

    await request(app.getHttpServer())
      .post(
        `${API}/businesses/${businessId}/approvals/${response.body.approval.id}/decision`,
      )
      .set('Authorization', bearer(owner))
      .send({ decision: ApprovalDecision.APPROVED })
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`${API}/businesses/${businessId}/bulk-operations/${response.body.operation.id}`)
      .set('Authorization', bearer(owner))
      .expect(200);

    expect(detail.body).toMatchObject({
      status: BulkOperationStatus.COMPLETED,
      succeeded: 2,
    });
    expect(await campaignStatus(bulkApprovalCampaignAId)).toBe(AdvertisingStatus.PAUSED);
    expect(await campaignStatus(bulkApprovalCampaignBId)).toBe(AdvertisingStatus.PAUSED);
  });

  it('runs the token monitoring worker against stored integrations', async () => {
    const processor = app.get(TokenMonitoringProcessor);
    const result = await processor.process({
      data: { limit: 10 },
    } as Job<{ limit?: number }>);

    expect(result.checked).toBeGreaterThanOrEqual(1);
    expect(result.refreshed).toBeGreaterThanOrEqual(1);
  });
});
