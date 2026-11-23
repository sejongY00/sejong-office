import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { installEmbeddedKoreanFontFaces } from './config/koreanFonts';
import { registerServiceWorker } from './pwa/serviceWorkerUpdates';
// Self-hosted, one ~2 MB file: bundled under /assets/ so the service worker keeps it for offline use.
import 'pretendard/dist/web/variable/pretendardvariable.css';
import './styles.css';

if (window.sejongDesktop) {
  installEmbeddedKoreanFontFaces();
}

const app = createApp(App);
let cadI18nInstalled = false;

router.beforeEach(async (to) => {
  if (to.name !== 'cad-viewer' || cadI18nInstalled) return;
  const { i18n } = await import('@mlightcad/cad-viewer');
  app.use(i18n);
  cadI18nInstalled = true;
});

app.use(router).mount('#app');

// Production only: a service worker in dev would cache Vite's unhashed modules and serve stale code.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker(navigator.serviceWorker).catch(() => {});
  });
}
