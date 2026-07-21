import { onMounted, onUnmounted, ref } from 'vue';

export type SystemTheme = 'light' | 'dark';

export function useSystemTheme() {
  const theme = ref<SystemTheme>('light');
  let media: MediaQueryList | null = null;

  function sync(event?: MediaQueryListEvent) {
    theme.value = (event?.matches ?? media?.matches) ? 'dark' : 'light';
  }

  onMounted(() => {
    media = window.matchMedia('(prefers-color-scheme: dark)');
    sync();
    media.addEventListener('change', sync);
  });

  onUnmounted(() => {
    media?.removeEventListener('change', sync);
    media = null;
  });

  return theme;
}
