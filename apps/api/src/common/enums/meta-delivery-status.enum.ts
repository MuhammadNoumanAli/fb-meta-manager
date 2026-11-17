/** Normalised Meta delivery/effective status, mapped from `effective_status`. */
export enum MetaDeliveryStatus {
  UNKNOWN = 'unknown',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
  PENDING_BILLING_INFO = 'pending_billing_info',
  IN_PROCESS = 'in_process',
  WITH_ISSUES = 'with_issues',
}
