import type { AccessType } from './auth';

export interface Business {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
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
}

export interface CreateAgencyPayload {
  name: string;
}
