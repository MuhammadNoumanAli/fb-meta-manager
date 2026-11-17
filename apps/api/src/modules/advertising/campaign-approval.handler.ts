import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { AdvertisingStatus } from '../../common/enums/advertising-status.enum';
import { ApprovalTargetType } from '../../common/enums/approval-target-type.enum';
import {
  ApprovalExecutionRegistry,
  type ApprovalExecutionInput,
  type ApprovalExecutionResult,
} from '../approvals/approval-execution.registry';
import { AdvertisingService } from './advertising.service';
import { CampaignPublishingService } from './campaign-publishing.service';

const STATUSES = Object.values(AdvertisingStatus);

/**
 * Executes approved campaign actions. Handlers call the internal, ungated
 * service methods so an approved payload runs exactly once and is never
 * re-submitted for approval.
 */
@Injectable()
export class CampaignApprovalHandler implements OnModuleInit {
  constructor(
    private readonly registry: ApprovalExecutionRegistry,
    private readonly advertising: AdvertisingService,
    private readonly publishing: CampaignPublishingService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      targetType: ApprovalTargetType.CAMPAIGN_PUBLISH,
      validatePayload: (payload) => this.validatePublish(payload),
      execute: (input) => this.executePublish(input),
    });
    this.registry.register({
      targetType: ApprovalTargetType.CAMPAIGN_STATUS,
      validatePayload: (payload) => this.validateStatus(payload),
      execute: (input) => this.executeStatus(input),
    });
  }

  private validatePublish(payload: Record<string, unknown>): void {
    if (typeof payload.campaignId !== 'string') {
      throw new BadRequestException('Publish approval payload needs a campaignId');
    }

    if (typeof payload.activate !== 'boolean') {
      throw new BadRequestException('Publish approval payload needs an activate flag');
    }
  }

  private validateStatus(payload: Record<string, unknown>): void {
    if (typeof payload.campaignId !== 'string') {
      throw new BadRequestException('Status approval payload needs a campaignId');
    }

    if (!STATUSES.includes(payload.status as AdvertisingStatus)) {
      throw new BadRequestException('Status approval payload needs a valid status');
    }
  }

  private async executePublish(
    input: ApprovalExecutionInput,
  ): Promise<ApprovalExecutionResult> {
    const campaignId = String(input.payload.campaignId);
    const activate = input.payload.activate === true;
    const campaign = await this.publishing.publishNow(
      input.actorUserId,
      input.request.businessId,
      campaignId,
      activate,
      input.context,
    );

    return {
      entityType: 'campaign',
      entityId: campaignId,
      summary: activate ? 'Publish queued as active' : 'Publish queued as paused',
      metadata: { activate, status: campaign.status },
    };
  }

  private async executeStatus(
    input: ApprovalExecutionInput,
  ): Promise<ApprovalExecutionResult> {
    const campaignId = String(input.payload.campaignId);
    const status = input.payload.status as AdvertisingStatus;
    const campaign = await this.advertising.applyStatusChange(
      input.actorUserId,
      input.request.businessId,
      campaignId,
      status,
      input.context,
    );

    return {
      entityType: 'campaign',
      entityId: campaignId,
      summary: `Campaign status set to ${campaign.status}`,
      metadata: { status: campaign.status },
    };
  }
}
