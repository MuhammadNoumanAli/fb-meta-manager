import type { ApprovalRequestView } from '../approvals/approvals.mappers';

/**
 * Returned instead of a campaign when the actor must obtain approval before
 * the change is applied. The request already carries the submitted payload.
 */
export interface CampaignApprovalPending {
  approvalRequired: true;
  approval: ApprovalRequestView;
  campaign: null;
}
