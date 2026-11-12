import { apiRequest } from './client';
import type { WorkspaceSummary } from '@/types/auth';
import type {
  AgencyClient,
  AgencyDetail,
  AgencyMember,
  AuditLogEntry,
  BusinessDetail,
  BusinessMember,
  CreateAgencyPayload,
  CreateBusinessPayload,
} from '@/types/workspace';

export const workspaceApi = {
  listBusinesses: () => apiRequest<WorkspaceSummary[]>('/businesses/mine'),

  createBusiness: (payload: CreateBusinessPayload) =>
    apiRequest<BusinessDetail>('/businesses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getBusiness: (businessId: string) =>
    apiRequest<BusinessDetail>(`/businesses/${businessId}`),

  updateBusiness: (businessId: string, payload: Partial<CreateBusinessPayload>) =>
    apiRequest<BusinessDetail>(`/businesses/${businessId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  listBusinessMembers: (businessId: string) =>
    apiRequest<BusinessMember[]>(`/businesses/${businessId}/members`),

  addBusinessMember: (
    businessId: string,
    payload: { email: string; roleKey: string },
  ) =>
    apiRequest<BusinessMember[]>(`/businesses/${businessId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateBusinessMember: (
    businessId: string,
    userId: string,
    payload: { roleKey?: string; status?: string },
  ) =>
    apiRequest<BusinessMember[]>(`/businesses/${businessId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  removeBusinessMember: (businessId: string, userId: string) =>
    apiRequest<BusinessMember[]>(`/businesses/${businessId}/members/${userId}`, {
      method: 'DELETE',
    }),

  listAuditLogs: (businessId: string, limit = 50) =>
    apiRequest<AuditLogEntry[]>(`/audit-logs?businessId=${businessId}&limit=${limit}`),

  listAgencies: () => apiRequest<WorkspaceSummary[]>('/agencies/mine'),

  createAgency: (payload: CreateAgencyPayload) =>
    apiRequest<AgencyDetail>('/agencies', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAgency: (agencyId: string) => apiRequest<AgencyDetail>(`/agencies/${agencyId}`),

  updateAgency: (agencyId: string, payload: { name?: string }) =>
    apiRequest<AgencyDetail>(`/agencies/${agencyId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  listAgencyClients: (agencyId: string) =>
    apiRequest<AgencyClient[]>(`/agencies/${agencyId}/clients`),

  createClient: (agencyId: string, payload: CreateBusinessPayload) =>
    apiRequest<BusinessDetail>(`/agencies/${agencyId}/clients`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  endClient: (agencyId: string, clientBusinessId: string) =>
    apiRequest<AgencyClient[]>(`/agencies/${agencyId}/clients/${clientBusinessId}`, {
      method: 'DELETE',
    }),

  listAgencyMembers: (agencyId: string) =>
    apiRequest<AgencyMember[]>(`/agencies/${agencyId}/members`),

  addAgencyMember: (agencyId: string, payload: { email: string; roleKey: string }) =>
    apiRequest<AgencyMember[]>(`/agencies/${agencyId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAgencyMember: (
    agencyId: string,
    userId: string,
    payload: { roleKey?: string; status?: string },
  ) =>
    apiRequest<AgencyMember[]>(`/agencies/${agencyId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  removeAgencyMember: (agencyId: string, userId: string) =>
    apiRequest<AgencyMember[]>(`/agencies/${agencyId}/members/${userId}`, {
      method: 'DELETE',
    }),
};
