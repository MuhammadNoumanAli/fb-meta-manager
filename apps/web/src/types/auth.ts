export type WorkspaceType = 'agency' | 'business';
export type AccessType = 'platform' | 'direct' | 'agency';

export interface WorkspaceSummary {
  type: WorkspaceType;
  id: string;
  tenantId: string;
  name: string;
  accessType: AccessType;
  roles: string[];
  permissions: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  createdAt: string;
}

export interface AuthResponse {
  user: UserProfile;
  accessToken: string;
}

export interface CurrentUserResponse {
  user: UserProfile;
  workspaces: WorkspaceSummary[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface ForgotPasswordResponse {
  message: string;
  resetToken?: string;
}
