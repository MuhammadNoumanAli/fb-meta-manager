import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from './auth';

const mocks = vi.hoisted(() => ({
  authToken: {
    set: vi.fn(),
    clear: vi.fn(),
  },
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
  },
}));

vi.mock('@/services/api/client', () => ({
  authToken: mocks.authToken,
  ApiError: class ApiError extends Error {},
}));

vi.mock('@/services/api/auth.api', () => ({ authApi: mocks.authApi }));

const { authApi, authToken } = mocks;

const user = {
  id: 'user-1',
  email: 'owner@example.com',
  firstName: 'Nadia',
  lastName: 'Rahman',
  status: 'active',
  createdAt: '2026-11-12T00:00:00.000Z',
};

const workspace = {
  type: 'business' as const,
  id: 'business-1',
  tenantId: 'tenant-1',
  name: 'Nadia Curtains',
  accessType: 'direct' as const,
  roles: ['business_owner'],
  permissions: ['business.read', 'business.update'],
};

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('stores the session and workspaces after signing in', async () => {
    authApi.login.mockResolvedValue({ user, accessToken: 'access-token' });
    authApi.me.mockResolvedValue({ user, workspaces: [workspace] });

    const auth = useAuthStore();
    await auth.signIn({ email: user.email, password: 'secret' });

    expect(authToken.set).toHaveBeenCalledWith('access-token');
    expect(auth.user?.id).toBe(user.id);
    expect(auth.workspaces).toHaveLength(1);
    expect(auth.isAuthenticated).toBe(true);
  });

  it('checks permissions within a workspace', async () => {
    authApi.me.mockResolvedValue({ user, workspaces: [workspace] });

    const auth = useAuthStore();
    await auth.initialize();

    expect(auth.hasPermission(workspace, 'business.update')).toBe(true);
    expect(auth.hasPermission(workspace, 'billing.manage')).toBe(false);
    expect(auth.findWorkspace('business', 'business-1')?.name).toBe('Nadia Curtains');
  });

  it('clears the session on sign out even if the API call fails', async () => {
    authApi.me.mockResolvedValue({ user, workspaces: [workspace] });
    authApi.logout.mockRejectedValue(new Error('network down'));

    const auth = useAuthStore();
    await auth.initialize();
    await auth.signOut();

    expect(auth.user).toBeNull();
    expect(auth.workspaces).toHaveLength(0);
    expect(authToken.clear).toHaveBeenCalled();
  });
});
