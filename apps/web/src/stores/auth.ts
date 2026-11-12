import { defineStore } from 'pinia';
import { ApiError, authToken } from '@/services/api/client';
import { authApi } from '@/services/api/auth.api';
import { invitationsApi } from '@/services/api/invitations.api';
import type {
  LoginPayload,
  RegisterPayload,
  UserProfile,
  WorkspaceSummary,
} from '@/types/auth';
import type { AcceptInvitationPayload } from '@/types/workspace';

interface AuthState {
  user: UserProfile | null;
  workspaces: WorkspaceSummary[];
  initialized: boolean;
  loading: boolean;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    workspaces: [],
    initialized: false,
    loading: false,
  }),

  getters: {
    isAuthenticated: (state): boolean => Boolean(state.user),
    displayName: (state): string =>
      state.user ? `${state.user.firstName} ${state.user.lastName}`.trim() : '',
    businessWorkspaces: (state): WorkspaceSummary[] =>
      state.workspaces.filter((workspace) => workspace.type === 'business'),
    agencyWorkspaces: (state): WorkspaceSummary[] =>
      state.workspaces.filter((workspace) => workspace.type === 'agency'),
  },

  actions: {
    async initialize(force = false): Promise<void> {
      if (this.initialized && !force) {
        return;
      }

      this.loading = true;

      try {
        const response = await authApi.me();
        this.user = response.user;
        this.workspaces = response.workspaces;
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          this.clearSession();
        }
      } finally {
        this.loading = false;
        this.initialized = true;
      }
    },

    async signIn(payload: LoginPayload): Promise<void> {
      const response = await authApi.login(payload);
      authToken.set(response.accessToken);
      this.user = response.user;
      const current = await authApi.me();
      this.user = current.user;
      this.workspaces = current.workspaces;
      this.initialized = true;
    },

    async signUp(payload: RegisterPayload): Promise<void> {
      const response = await authApi.register(payload);
      authToken.set(response.accessToken);
      this.user = response.user;
      const current = await authApi.me();
      this.user = current.user;
      this.workspaces = current.workspaces;
      this.initialized = true;
    },

    async acceptInvitation(
      token: string,
      payload: AcceptInvitationPayload,
    ): Promise<string> {
      const response = await invitationsApi.accept(token, payload);
      authToken.set(response.accessToken);
      this.user = response.user;
      const current = await authApi.me();
      this.user = current.user;
      this.workspaces = current.workspaces;
      this.initialized = true;

      return response.businessId;
    },

    async signOut(): Promise<void> {
      try {
        await authApi.logout();
      } catch {
        // The local session is cleared even when the API cannot be reached.
      } finally {
        this.clearSession();
      }
    },

    async reload(): Promise<void> {
      const response = await authApi.me();
      this.user = response.user;
      this.workspaces = response.workspaces;
      this.initialized = true;
    },

    clearSession(): void {
      authToken.clear();
      this.user = null;
      this.workspaces = [];
      this.initialized = true;
    },

    findWorkspace(type: 'business' | 'agency', id: string): WorkspaceSummary | undefined {
      return this.workspaces.find((workspace) => workspace.type === type && workspace.id === id);
    },

    hasPermission(workspace: WorkspaceSummary | null | undefined, permission: string): boolean {
      return Boolean(workspace?.permissions.includes(permission));
    },
  },
});
