/** Stage recorded in `webhook_processing_logs`. */
export enum WebhookProcessingStatus {
  RECEIVED = 'received',
  QUEUED = 'queued',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  IGNORED = 'ignored',
  RETRY_QUEUED = 'retry_queued',
}
