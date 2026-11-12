import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';

export default createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1565C0',
          secondary: '#00897B',
          background: '#F5F7FA',
        },
      },
    },
  },
  defaults: {
    VBtn: { variant: 'flat' },
  },
});
