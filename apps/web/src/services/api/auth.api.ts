import { apiRequest } from './client';
import type {
  AuthResponse,
  CurrentUserResponse,
  ForgotPasswordResponse,
  LoginPayload,
  RegisterPayload,
  UserProfile,
} from '@/types/auth';

export const authApi = {
  register: (payload: RegisterPayload) =>
    apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    }),

  login: (payload: LoginPayload) =>
    apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    }),

  logout: () =>
    apiRequest<{ success: boolean }>('/auth/logout', {
      method: 'POST',
      body: '{}',
      skipAuth: true,
    }),

  forgotPassword: (email: string) =>
    apiRequest<ForgotPasswordResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
      skipAuth: true,
    }),

  resetPassword: (token: string, password: string) =>
    apiRequest<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
      skipAuth: true,
    }),

  me: () => apiRequest<CurrentUserResponse>('/users/me'),

  updateProfile: (payload: { firstName?: string; lastName?: string }) =>
    apiRequest<UserProfile>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};
