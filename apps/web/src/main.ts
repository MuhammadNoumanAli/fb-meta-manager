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

createApp(App).use(createPinia()).use(router).use(vuetify).mount('#app');
