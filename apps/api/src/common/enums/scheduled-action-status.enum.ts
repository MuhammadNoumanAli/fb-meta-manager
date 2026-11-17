/** Lifecycle of a one-off scheduled campaign action. */
export enum ScheduledActionStatus {
  SCHEDULED = 'scheduled',
  QUEUED = 'queued',
  PENDING_APPROVAL = 'pending_approval',
  EXECUTED = 'executed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SKIPPED = 'skipped',
}
