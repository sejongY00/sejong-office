import { mount, RouterLinkStub } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_LATEST_RELEASE_URL } from '@/config/app';
import EditorToolbar from './EditorToolbar.vue';

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

function mountToolbar() {
  return mount(EditorToolbar, {
    props: {
      filename: 'example.mmd',
    },
    global: {
      stubs: {
        RouterLink: RouterLinkStub,
      },
    },
  });
}

describe('EditorToolbar release download button', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    delete window.sejongDesktop;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('shows the download link directly to the left of the license link in web mode', () => {
    mockMatchMedia(false);
    const wrapper = mountToolbar();

    const downloadLink = wrapper.find('[data-download-release-link]');
    expect(downloadLink.exists()).toBe(true);
    expect(downloadLink.element.tagName).toBe('A');
    expect(downloadLink.attributes('href')).toBe(APP_LATEST_RELEASE_URL);
    expect(downloadLink.attributes('target')).toBe('_blank');
    expect(downloadLink.attributes('rel')).toBe('noopener noreferrer');
    expect(downloadLink.attributes('aria-label')).toBe('데스크톱 앱 다운로드');
    expect(downloadLink.find('svg').exists()).toBe(true);

    const rightControls = wrapper.find('.toolbar__right').findAll('a, button');
    const downloadIndex = rightControls.findIndex((el) =>
      el.element.hasAttribute('data-download-release-link'),
    );
    const licenseIndex = rightControls.findIndex(
      (el) => el.attributes('aria-label') === '라이선스',
    );
    expect(downloadIndex).toBeGreaterThanOrEqual(0);
    expect(licenseIndex - downloadIndex).toBe(1);
  });

  it('still shows the download link directly to the left of the license link in PWA standalone mode', () => {
    mockMatchMedia(true);
    const wrapper = mountToolbar();

    const downloadLink = wrapper.find('[data-download-release-link]');
    expect(downloadLink.exists()).toBe(true);
    expect(downloadLink.attributes('href')).toBe(
      'https://github.com/sejongY00/sejong-office/releases/latest',
    );

    const rightControls = wrapper.find('.toolbar__right').findAll('a, button');
    const downloadIndex = rightControls.findIndex((el) =>
      el.element.hasAttribute('data-download-release-link'),
    );
    const licenseIndex = rightControls.findIndex(
      (el) => el.attributes('aria-label') === '라이선스',
    );
    expect(downloadIndex).toBeGreaterThanOrEqual(0);
    expect(licenseIndex - downloadIndex).toBe(1);
  });

  it('hides the download link in Electron desktop mode while keeping license and window controls', () => {
    mockMatchMedia(false);
    window.sejongDesktop = mockDesktopBridge();
    const wrapper = mountToolbar();

    expect(wrapper.find('[data-download-release-link]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="라이선스"]').exists()).toBe(true);
    expect(wrapper.find('.win-controls').exists()).toBe(true);
  });
});
