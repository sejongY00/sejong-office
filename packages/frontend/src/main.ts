import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './styles.css';

const app = createApp(App);
let cadI18nInstalled = false;

router.beforeEach(async (to) => {
  if (to.name !== 'cad-viewer' || cadI18nInstalled) return;
  const { i18n } = await import('@mlightcad/cad-viewer');
  app.use(i18n);
  cadI18nInstalled = true;
});

app.use(router).mount('#app');
