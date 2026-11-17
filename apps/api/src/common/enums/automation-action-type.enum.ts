/** The operation an automation rule or scheduled action performs. */
export enum AutomationActionType {
  PAUSE_CAMPAIGN = 'pause_campaign',
  RESUME_CAMPAIGN = 'resume_campaign',
  ARCHIVE_CAMPAIGN = 'archive_campaign',
  SYNC_CAMPAIGN = 'sync_campaign',
  NOTIFY = 'notify',
}

export const CAMPAIGN_ACTION_TYPES: AutomationActionType[] = [
  AutomationActionType.PAUSE_CAMPAIGN,
  AutomationActionType.RESUME_CAMPAIGN,
  AutomationActionType.ARCHIVE_CAMPAIGN,
  AutomationActionType.SYNC_CAMPAIGN,
];
