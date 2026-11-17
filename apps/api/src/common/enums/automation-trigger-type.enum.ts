/** What causes an automation rule to produce an execution. */
export enum AutomationTriggerType {
  SCHEDULE = 'schedule',
  CAMPAIGN_REJECTED = 'campaign_rejected',
  BUDGET_THRESHOLD = 'budget_threshold',
}
