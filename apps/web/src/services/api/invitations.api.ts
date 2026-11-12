import { apiRequest } from './client';
import type {
  AcceptInvitationPayload,
  AcceptInvitationResult,
  InvitationPreview,
} from '@/types/workspace';

const tokenPath = (token: string): string => `/invitations/${encodeURIComponent(token)}`;

export const invitationsApi = {
  preview: (token: string) =>
    apiRequest<InvitationPreview>(tokenPath(token), { skipAuth: true }),

  accept: (token: string, payload: AcceptInvitationPayload) =>
    apiRequest<AcceptInvitationResult>(`${tokenPath(token)}/accept`, {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    }),
};
