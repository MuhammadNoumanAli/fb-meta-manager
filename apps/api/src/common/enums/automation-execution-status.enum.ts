/** Lifecycle of one automation rule execution. */
export enum AutomationExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PENDING_APPROVAL = 'pending_approval',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  DEAD_LETTER = 'dead_letter',
}
