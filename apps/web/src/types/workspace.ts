import type { AccessType, UserProfile } from './auth';

export interface Business {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  industry: string | null;
  description: string | null;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Agency {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessDetail {
  business: Business;
  accessType: AccessType;
  roles: string[];
  permissions: string[];
  agencyId: string | null;
}

export interface AgencyDetail {
  agency: Agency;
  accessType: 'platform' | 'agency';
  roles: string[];
  permissions: string[];
}

export interface BusinessMember {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roles: string[];
  joinedAt: string;
}

export interface AgencyMember {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roles: string[];
  joinedAt: string;
}

export interface AgencyClient {
  businessId: string;
  name: string;
  slug: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorUserId: string | null;
  tenantId: string | null;
  businessId: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface CreateBusinessPayload {
  name: string;
  timezone?: string;
  currency?: string;
  industry?: string;
  description?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export type UpdateBusinessPayload = Partial<CreateBusinessPayload>;

export interface CreateAgencyPayload {
  name: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface InvitationSummary {
  id: string;
  email: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  token?: string;
  acceptanceUrl?: string;
}

export interface InvitationPreview {
  email: string;
  agencyName: string;
  businessName: string;
  businessSlug: string;
  expiresAt: string;
  hasAccount: boolean;
}

export interface CreateInvitationPayload {
  email: string;
  expiresInDays?: number;
}

export interface AcceptInvitationPayload {
  password: string;
  firstName?: string;
  lastName?: string;
  timezone?: string;
  currency?: string;
  industry?: string;
  description?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface AcceptInvitationResult {
  user: UserProfile;
  accessToken: string;
  businessId: string;
}
