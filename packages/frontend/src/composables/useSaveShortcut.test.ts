import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { isApplePlatform, isSaveShortcut, useSaveShortcut } from './useSaveShortcut';

function key(init: KeyboardEventInit) {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
}

function primarySaveKey(extra: KeyboardEventInit = {}): KeyboardEvent {
  const apple = isApplePlatform();
  return key({
    key: 's',
    code: 'KeyS',
    ctrlKey: !apple,
    metaKey: apple,
    ...extra,
  });
}

describe('isSaveShortcut', () => {
  it.each([
    ['Ctrl+S on Windows/Linux', { key: 's', code: 'KeyS', ctrlKey: true }, false],
    ['Ctrl+S with Caps Lock on Windows/Linux', { key: 'S', code: 'KeyS', ctrlKey: true }, false],
    ['Ctrl+S on a Korean layout on Windows/Linux', { key: 'ㄴ', code: 'KeyS', ctrlKey: true }, false],
    ['Cmd+S on macOS', { key: 's', code: 'KeyS', metaKey: true }, true],
    ['Cmd+S with Caps Lock on macOS', { key: 'S', code: 'KeyS', metaKey: true }, true],
    ['Cmd+S on a Korean layout on macOS', { key: 'ㄴ', code: 'KeyS', metaKey: true }, true],
  ])('accepts %s', (_, init, apple) => {
    expect(isSaveShortcut(key(init), apple)).toBe(true);
  });

  it.each([
    ['plain S', { key: 's', code: 'KeyS' }, false],
    ['Cmd+S on Windows/Linux', { key: 's', code: 'KeyS', metaKey: true }, false],
    ['Ctrl+S on macOS', { key: 's', code: 'KeyS', ctrlKey: true }, true],
    ['Ctrl+Cmd+S together', { key: 's', code: 'KeyS', ctrlKey: true, metaKey: true }, true],
    ['Ctrl+Shift+S (save as elsewhere)', { key: 'S', code: 'KeyS', ctrlKey: true, shiftKey: true }, false],
    ['Cmd+Shift+S on macOS', { key: 'S', code: 'KeyS', metaKey: true, shiftKey: true }, true],
    ['Ctrl+Alt+S', { key: 's', code: 'KeyS', ctrlKey: true, altKey: true }, false],
    ['Ctrl+D', { key: 'd', code: 'KeyD', ctrlKey: true }, false],
  ])('ignores %s', (_, init, apple) => {
    expect(isSaveShortcut(key(init), apple)).toBe(false);
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

    const event = primarySaveKey();
    wrapper.find('textarea').element.dispatchEvent(event);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    expect(inner).not.toHaveBeenCalled();
    document.removeEventListener('keydown', inner);
  });

  it('ignores auto-repeat while the keys are held', () => {
    const onSave = vi.fn();
    wrapper = mount(Page, { props: { onSave } });
    window.dispatchEvent(primarySaveKey({ repeat: true }));
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
    window.dispatchEvent(primarySaveKey());
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
    const press = () => window.dispatchEvent(primarySaveKey());

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
