import { mount, RouterLinkStub } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { APP_LATEST_RELEASE_URL } from '@/config/app';
import HomeView from './HomeView.vue';

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/licenses', name: 'licenses', component: { template: '<div />' } },
    ],
  });
}

function mockDesktopBridge(): SejongDesktopBridge {
  return {
    isDesktop: true,
    consumeLaunchFiles: vi.fn(async () => []),
    onOpenFiles: vi.fn(() => () => {}),
    readFile: vi.fn(),
    statFile: vi.fn(),
    writeFile: vi.fn(),
  };
}

function mockMatchMedia(standalone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: standalone && query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  });
}

async function mountHomeView() {
  const router = createTestRouter();
  await router.push('/');
  await router.isReady();
  return mount(HomeView, {
    global: {
      plugins: [router],
      stubs: {
        RouterLink: RouterLinkStub,
      },
    },
  });
}

describe('HomeView topbar release download button', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    delete window.sejongDesktop;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('shows the download link strictly to the left of the license link in standard web mode', async () => {
    mockMatchMedia(false);
    const wrapper = await mountHomeView();

    const downloadLink = wrapper.find('[data-download-release-link]');
    expect(downloadLink.exists()).toBe(true);
    expect(downloadLink.element.tagName).toBe('A');
    expect(downloadLink.attributes('href')).toBe(APP_LATEST_RELEASE_URL);
    expect(downloadLink.attributes('target')).toBe('_blank');
    expect(downloadLink.attributes('rel')).toBe('noopener noreferrer');
    expect(downloadLink.attributes('aria-label')).toBe('데스크톱 앱 다운로드');
    expect(downloadLink.find('svg').exists()).toBe(true);

    const actions = wrapper.find('.home__actions');
    const items = actions.findAll('a, button');
    const downloadIndex = items.findIndex((el) =>
      el.element.hasAttribute('data-download-release-link'),
    );
    const licenseIndex = items.findIndex(
      (el) => el.attributes('aria-label') === '오픈소스 라이선스',
    );
    expect(downloadIndex).toBeGreaterThanOrEqual(0);
    expect(licenseIndex).toBeGreaterThan(downloadIndex);
    expect(licenseIndex - downloadIndex).toBe(1);

    const tooltipWrap = downloadLink.element.closest('.home__tooltip-wrap');
    expect(tooltipWrap?.querySelector('[role="tooltip"]')?.textContent).toContain(
      '데스크톱 앱 다운로드',
    );
  });

  it('still shows the download link to the left of the license link in PWA standalone mode', async () => {
    mockMatchMedia(true);
    const wrapper = await mountHomeView();

    const downloadLink = wrapper.find('[data-download-release-link]');
    expect(downloadLink.exists()).toBe(true);
    expect(downloadLink.attributes('href')).toBe(
      'https://github.com/sejongY00/sejong-office/releases/latest',
    );

    const items = wrapper.find('.home__actions').findAll('a, button');
    const downloadIndex = items.findIndex((el) =>
      el.element.hasAttribute('data-download-release-link'),
    );
    const licenseIndex = items.findIndex(
      (el) => el.attributes('aria-label') === '오픈소스 라이선스',
    );
    expect(downloadIndex).toBeGreaterThanOrEqual(0);
    expect(licenseIndex - downloadIndex).toBe(1);
  });

  it('hides the download link in Electron desktop mode', async () => {
    mockMatchMedia(false);
    window.sejongDesktop = mockDesktopBridge();
    const wrapper = await mountHomeView();

    expect(wrapper.find('[data-download-release-link]').exists()).toBe(false);
    // Desktop mode shows the update check button to the left of License instead
    const licenseLink = wrapper.find('[aria-label="오픈소스 라이선스"]');
    expect(licenseLink.exists()).toBe(true);
    const updateBtn = wrapper.find('.home__actions button[aria-label^="업데이트 확인"]');
    expect(updateBtn.exists()).toBe(true);
  });
});
