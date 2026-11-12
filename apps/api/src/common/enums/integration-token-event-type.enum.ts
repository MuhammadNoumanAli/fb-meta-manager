export enum IntegrationTokenEventType {
  AUTHORIZED = 'authorized',
  SYSTEM_USER_CONNECTED = 'system_user_connected',
  REAUTHORIZED = 'reauthorized',
  VALIDATED = 'validated',
  PERMISSIONS_CHANGED = 'permissions_changed',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  ERROR = 'error',
  DISCOVERED = 'discovered',
  DISCONNECTED = 'disconnected',
}
