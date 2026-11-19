import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { isSaveShortcut, useSaveShortcut } from './useSaveShortcut';

function key(init: KeyboardEventInit) {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
}

describe('isSaveShortcut', () => {
  it.each([
    ['Ctrl+S', { key: 's', code: 'KeyS', ctrlKey: true }],
    ['Cmd+S', { key: 's', code: 'KeyS', metaKey: true }],
    ['Ctrl+S with Caps Lock', { key: 'S', code: 'KeyS', ctrlKey: true }],
    ['Ctrl+S on a Korean layout', { key: 'ㄴ', code: 'KeyS', ctrlKey: true }],
  ])('accepts %s', (_, init) => {
    expect(isSaveShortcut(key(init))).toBe(true);
  });

  it.each([
    ['plain S', { key: 's', code: 'KeyS' }],
    ['Ctrl+Shift+S (save as elsewhere)', { key: 'S', code: 'KeyS', ctrlKey: true, shiftKey: true }],
    ['Ctrl+Alt+S', { key: 's', code: 'KeyS', ctrlKey: true, altKey: true }],
    ['Ctrl+D', { key: 'd', code: 'KeyD', ctrlKey: true }],
  ])('ignores %s', (_, init) => {
    expect(isSaveShortcut(key(init))).toBe(false);
  });
});

describe('useSaveShortcut', () => {
  let wrapper: VueWrapper | undefined;
  afterEach(() => wrapper?.unmount());

  const Page = defineComponent({
    name: 'Page',
    props: { onSave: { type: Function, required: true } },
    setup(props) {
      useSaveShortcut(() => (props.onSave as () => void)());
      return () => h('textarea');
    },
  });

  it('runs onSave and blocks the browser dialog and inner editors', () => {
    const onSave = vi.fn();
    const inner = vi.fn();
    wrapper = mount(Page, { props: { onSave }, attachTo: document.body });
    document.addEventListener('keydown', inner);

    const event = key({ key: 's', code: 'KeyS', ctrlKey: true });
    wrapper.find('textarea').element.dispatchEvent(event);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    expect(inner).not.toHaveBeenCalled();
    document.removeEventListener('keydown', inner);
  });

  it('ignores auto-repeat while the keys are held', () => {
    const onSave = vi.fn();
    wrapper = mount(Page, { props: { onSave } });
    window.dispatchEvent(key({ key: 's', code: 'KeyS', ctrlKey: true, repeat: true }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('leaves other keys alone', () => {
    const onSave = vi.fn();
    wrapper = mount(Page, { props: { onSave } });
    const event = key({ key: 'a', code: 'KeyA', ctrlKey: true });
    window.dispatchEvent(event);
    expect(onSave).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('stops listening once the page is unmounted', () => {
    const onSave = vi.fn();
    wrapper = mount(Page, { props: { onSave } });
    wrapper.unmount();
    wrapper = undefined;
    window.dispatchEvent(key({ key: 's', code: 'KeyS', ctrlKey: true }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('pauses while a kept-alive page is hidden and resumes when shown again', async () => {
    const onSave = vi.fn();
    const show = ref(true);
    wrapper = mount(
      defineComponent({
        setup: () => () => h(KeepAlive, null, show.value ? h(Page, { onSave }) : h('div')),
      }),
    );
    const press = () => window.dispatchEvent(key({ key: 's', code: 'KeyS', ctrlKey: true }));

    show.value = false;
    await nextTick();
    press();
    expect(onSave).not.toHaveBeenCalled();

    show.value = true;
    await nextTick();
    press();
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
