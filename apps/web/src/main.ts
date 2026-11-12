import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import './assets/main.css';
import App from './App.vue';
import router from './router';
import vuetify from './plugins/vuetify';
import { onSessionExpired } from './services/api/client';
import { useAuthStore } from './stores/auth';

const pinia = createPinia();
const app = createApp(App).use(pinia).use(router).use(vuetify);

const auth = useAuthStore(pinia);
onSessionExpired(() => {
  auth.clearSession();
  const current = router.currentRoute.value;

  if (current.meta.requiresAuth) {
    void router.push({
      name: 'login',
      query: current.fullPath === '/' ? undefined : { redirect: current.fullPath },
    });
  }
});

app.mount('#app');
