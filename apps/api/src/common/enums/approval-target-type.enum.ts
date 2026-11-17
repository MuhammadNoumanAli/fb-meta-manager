/** Actions that can be routed through the reusable approval engine. */
export enum ApprovalTargetType {
  CAMPAIGN_PUBLISH = 'campaign.publish',
  CAMPAIGN_STATUS = 'campaign.status',
  BUDGET_CHANGE = 'budget.change',
  AUTOMATION_ACTION = 'automation.execute',
  BULK_OPERATION = 'bulk.execute',
}
