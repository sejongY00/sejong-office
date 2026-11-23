import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DesktopWindowControls from './DesktopWindowControls.vue';

describe('DesktopWindowControls', () => {
  afterEach(() => {
    delete window.sejongDesktop;
  });

  it('renders single 닫기 icon button in browser mode and emits home on click', async () => {
    const wrapper = mount(DesktopWindowControls);
    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].attributes('aria-label')).toBe('닫기');
    expect(buttons[0].find('svg').exists()).toBe(true);

    await buttons[0].trigger('click');
    expect(wrapper.emitted('home')).toHaveLength(1);
  });

  it('renders [홈 최소화 최대화 닫기] icon buttons in desktop mode and calls actual app close on 닫기', async () => {
    const minimizeWindow = vi.fn(async () => {});
    const toggleMaximizeWindow = vi.fn(async () => true);
    const closeApp = vi.fn(async () => {});

    window.sejongDesktop = {
      isDesktop: true,
      consumeLaunchFiles: vi.fn(async () => []),
      onOpenFiles: vi.fn(() => () => {}),
      readFile: vi.fn(),
      statFile: vi.fn(),
      writeFile: vi.fn(),
      minimizeWindow,
      toggleMaximizeWindow,
      closeApp,
    };

    const wrapper = mount(DesktopWindowControls);
    const buttons = wrapper.findAll('button');
    expect(buttons.map((b) => b.attributes('aria-label'))).toEqual([
      '홈',
      '최소화',
      '최대화',
      '닫기',
    ]);
    for (const btn of buttons) {
      expect(btn.find('svg').exists()).toBe(true);
    }

    await buttons[0].trigger('click');
    expect(wrapper.emitted('home')).toHaveLength(1);

    await buttons[1].trigger('click');
    expect(minimizeWindow).toHaveBeenCalledTimes(1);

    await buttons[2].trigger('click');
    expect(toggleMaximizeWindow).toHaveBeenCalledTimes(1);

    await buttons[3].trigger('click');
    expect(closeApp).toHaveBeenCalledTimes(1);
  });

  it('respects beforeCloseApp guard when 닫기 is clicked in desktop mode', async () => {
    const closeApp = vi.fn(async () => {});
    window.sejongDesktop = {
      isDesktop: true,
      consumeLaunchFiles: vi.fn(async () => []),
      onOpenFiles: vi.fn(() => () => {}),
      readFile: vi.fn(),
      statFile: vi.fn(),
      writeFile: vi.fn(),
      closeApp,
    };

    const beforeCloseApp = vi.fn(async () => false);
    const wrapper = mount(DesktopWindowControls, {
      props: { beforeCloseApp },
    });

    await wrapper.find('[data-win-action="close"]').trigger('click');
    expect(beforeCloseApp).toHaveBeenCalledTimes(1);
    expect(closeApp).not.toHaveBeenCalled();
  });
});
