/**
 * Permission keys enforced by the API. Keep this list in sync with the
 * role seeding in the Phase 1 migration.
 */
export const PERMISSIONS = {
  PLATFORM_MANAGE: 'platform.manage',
  AGENCY_MANAGE: 'agency.manage',
  BUSINESS_CREATE: 'business.create',
  BUSINESS_READ: 'business.read',
  BUSINESS_UPDATE: 'business.update',
  BUSINESS_MANAGE_MEMBERS: 'business.manage_members',
  CAMPAIGN_READ: 'campaign.read',
  CAMPAIGN_CREATE: 'campaign.create',
  CAMPAIGN_UPDATE: 'campaign.update',
  CAMPAIGN_PUBLISH: 'campaign.publish',
  BUDGET_MANAGE: 'budget.manage',
  APPROVAL_REQUEST: 'approval.request',
  APPROVAL_DECIDE: 'approval.decide',
  LEAD_READ: 'lead.read',
  LEAD_MANAGE: 'lead.manage',
  REPORT_READ: 'report.read',
  INTEGRATION_MANAGE: 'integration.manage',
  AUDIT_READ: 'audit.read',
  BILLING_MANAGE: 'billing.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const SYSTEM_ROLES = {
  PLATFORM_ADMIN: 'platform_admin',
  AGENCY_OWNER: 'agency_owner',
  AGENCY_ADMIN: 'agency_admin',
  AGENCY_STAFF: 'agency_staff',
  BUSINESS_OWNER: 'business_owner',
  BUSINESS_ADMIN: 'business_admin',
  BUSINESS_VIEWER: 'business_viewer',
} as const;

export type SystemRoleKey = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];
