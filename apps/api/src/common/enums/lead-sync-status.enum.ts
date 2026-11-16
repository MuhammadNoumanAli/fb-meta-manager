/** Outcome recorded in `lead_sync_logs` for every intake attempt. */
export enum LeadSyncStatus {
  RECEIVED = 'received',
  FETCHED = 'fetched',
  CREATED = 'created',
  DUPLICATE = 'duplicate',
  FAILED = 'failed',
  IGNORED = 'ignored',
}
