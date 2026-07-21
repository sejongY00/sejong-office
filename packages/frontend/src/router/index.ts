import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/editor/onlyoffice/:docId',
      name: 'onlyoffice-editor',
      component: () => import('@/views/OnlyOfficeEditorView.vue'),
    },
    {
      path: '/editor/rhwp',
      name: 'rhwp-editor',
      component: () => import('@/views/RhwpEditorView.vue'),
    },
    {
      path: '/editor/excalidraw',
      name: 'excalidraw-editor',
      component: () => import('@/views/ExcalidrawEditorView.vue'),
    },
    {
      path: '/editor/mermaid',
      name: 'mermaid-editor',
      component: () => import('@/views/MermaidEditorView.vue'),
    },
    {
      path: '/editor/drawio',
      name: 'drawio-editor',
      component: () => import('@/views/DrawioEditorView.vue'),
    },
    {
      path: '/licenses',
      name: 'licenses',
      component: () => import('@/views/LicensesView.vue'),
    },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
