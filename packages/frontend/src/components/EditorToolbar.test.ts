import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasAnyUnsavedChanges } from '@/composables/useUnsavedGuard';
import { APP_LATEST_RELEASE_URL } from '@/config/app';
import type { DocumentSaveStatus } from '@/composables/usePageTitle';
import EditorToolbar from './EditorToolbar.vue';

function mockDesktopBridge(
  overrides: Partial<SejongDesktopBridge> = {},
): SejongDesktopBridge {
  return {
    isDesktop: true,
    consumeLaunchFiles: vi.fn(async () => []),
    onOpenFiles: vi.fn(() => () => {}),
    readFile: vi.fn(),
    statFile: vi.fn(),
    writeFile: vi.fn(),
    ...overrides,
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

function mountToolbar(saveStatus: DocumentSaveStatus = 'pristine') {
  return mount(EditorToolbar, {
    props: {
      filename: 'example.mmd',
      saveStatus,
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
    vi.restoreAllMocks();
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

  it('tracks modified saveStatus in unsaved checker and beforeunload', async () => {
    const wrapper = mountToolbar('modified');
    expect(await hasAnyUnsavedChanges()).toBe(true);

    const modifiedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(modifiedUnload);
    expect(modifiedUnload.defaultPrevented).toBe(true);

    await wrapper.setProps({ saveStatus: 'saved' });
    expect(await hasAnyUnsavedChanges()).toBe(false);

    const savedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(savedUnload);
    expect(savedUnload.defaultPrevented).toBe(false);

    await wrapper.setProps({ saveStatus: 'modified' });
    expect(await hasAnyUnsavedChanges()).toBe(true);
    wrapper.unmount();
    expect(await hasAnyUnsavedChanges()).toBe(false);
  });

  it('uses desktop native confirm dialog on home and close buttons when modified', async () => {
    const confirmUnsavedChanges = vi
      .fn<(action?: 'close' | 'leave') => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const closeApp = vi.fn(async () => {});
    const windowConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    window.sejongDesktop = mockDesktopBridge({
      confirmUnsavedChanges,
      closeApp,
    });

    const wrapper = mountToolbar('modified');

    await wrapper.find('[data-win-action="home"]').trigger('click');
    await flushPromises();
    expect(wrapper.emitted('close')).toBeUndefined();

    await wrapper.find('[data-win-action="home"]').trigger('click');
    await flushPromises();
    expect(wrapper.emitted('close')).toHaveLength(1);

    await wrapper.find('[data-win-action="close"]').trigger('click');
    await flushPromises();
    expect(closeApp).not.toHaveBeenCalled();

    await wrapper.find('[data-win-action="close"]').trigger('click');
    await flushPromises();
    expect(closeApp).toHaveBeenCalledTimes(1);

    expect(confirmUnsavedChanges).toHaveBeenNthCalledWith(1, 'leave');
    expect(confirmUnsavedChanges).toHaveBeenNthCalledWith(2, 'leave');
    expect(confirmUnsavedChanges).toHaveBeenNthCalledWith(3, 'close');
    expect(confirmUnsavedChanges).toHaveBeenNthCalledWith(4, 'close');
    expect(windowConfirm).not.toHaveBeenCalled();
  });
});
