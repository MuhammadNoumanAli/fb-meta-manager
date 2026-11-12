import { createRouter, createWebHistory } from 'vue-router';
import DefaultLayout from '@/layouts/DefaultLayout.vue';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: DefaultLayout,
      children: [
        {
          path: '',
          name: 'workspaces',
          component: () => import('@/views/workspaces/WorkspacesView.vue'),
          meta: { requiresAuth: true, title: 'Workspaces' },
        },
        {
          path: 'system-status',
          name: 'system-status',
          component: () => import('@/views/dashboard/DashboardView.vue'),
          meta: { requiresAuth: true, title: 'System status' },
        },
        {
          path: 'businesses/:businessId',
          name: 'business-detail',
          component: () => import('@/views/businesses/BusinessDetailView.vue'),
          meta: { requiresAuth: true, title: 'Business workspace' },
        },
        {
          path: 'agencies/:agencyId',
          name: 'agency-detail',
          component: () => import('@/views/agencies/AgencyDetailView.vue'),
          meta: { requiresAuth: true, title: 'Agency' },
        },
      ],
    },
    {
      path: '/login',
      component: AuthLayout,
      children: [
        {
          path: '',
          name: 'login',
          component: () => import('@/views/auth/LoginView.vue'),
          meta: { guestOnly: true, title: 'Sign in' },
        },
      ],
    },
    {
      path: '/register',
      component: AuthLayout,
      children: [
        {
          path: '',
          name: 'register',
          component: () => import('@/views/auth/RegisterView.vue'),
          meta: { guestOnly: true, title: 'Create account' },
        },
      ],
    },
    {
      path: '/forgot-password',
      component: AuthLayout,
      children: [
        {
          path: '',
          name: 'forgot-password',
          component: () => import('@/views/auth/ForgotPasswordView.vue'),
          meta: { guestOnly: true, title: 'Reset password' },
        },
      ],
    },
    {
      path: '/reset-password',
      component: AuthLayout,
      children: [
        {
          path: '',
          name: 'reset-password',
          component: () => import('@/views/auth/ResetPasswordView.vue'),
          meta: { guestOnly: true, title: 'Choose a new password' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!auth.initialized) {
    await auth.initialize();
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return {
      name: 'login',
      query: to.fullPath === '/' ? undefined : { redirect: to.fullPath },
    };
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'workspaces' };
  }

  return true;
});

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : null;
  document.title = title ? `${title} · AdPilot` : 'AdPilot';
});

export default router;
