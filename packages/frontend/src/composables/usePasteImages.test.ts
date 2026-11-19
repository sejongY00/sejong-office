import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { imageFilesFromClipboard, usePasteImages } from './usePasteImages';

const NOW = new Date(2026, 10, 19, 9, 5, 7);

/** Minimal stand-in for the clipboard's DataTransfer (jsdom has none). */
function clipboard(files: File[], types: string[] = files.length ? ['Files'] : []): DataTransfer {
  return {
    files,
    items: files.map((file) => ({ kind: 'file', type: file.type, getAsFile: () => file })),
    types,
  } as unknown as DataTransfer;
}

function png(name = 'image.png') {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
}

describe('imageFilesFromClipboard', () => {
  it('returns nothing for an empty or missing clipboard', () => {
    expect(imageFilesFromClipboard(null)).toEqual([]);
    expect(imageFilesFromClipboard(clipboard([]))).toEqual([]);
  });

  it('gives a screenshot a dated name with the right extension', () => {
    const [file] = imageFilesFromClipboard(clipboard([png()]), NOW);
    expect(file.name).toBe('붙여넣기-20261119-090507.png');
    expect(file.type).toBe('image/png');
    expect(file.size).toBe(3);
  });

  it('numbers several pasted screenshots', () => {
    const jpeg = new File(['x'], 'image.jpg', { type: 'image/jpeg' });
    const names = imageFilesFromClipboard(clipboard([png(), jpeg]), NOW).map((f) => f.name);
    expect(names).toEqual(['붙여넣기-20261119-090507-1.png', '붙여넣기-20261119-090507-2.jpg']);
  });

  it('keeps the name of a copied file', () => {
    const photo = png('영수증.png');
    expect(imageFilesFromClipboard(clipboard([photo]), NOW)).toEqual([photo]);
  });

  it('skips files that are not images', () => {
    const pdf = new File(['%PDF'], 'a.pdf', { type: 'application/pdf' });
    expect(imageFilesFromClipboard(clipboard([pdf]))).toEqual([]);
  });

  it('falls back to clipboard items when files is empty', () => {
    const file = png();
    const data = {
      files: [],
      items: [
        { kind: 'string', type: 'text/plain', getAsFile: () => null },
        { kind: 'file', type: 'image/png', getAsFile: () => file },
      ],
      types: ['Files'],
    } as unknown as DataTransfer;
    expect(imageFilesFromClipboard(data, NOW)).toHaveLength(1);
  });
});

describe('usePasteImages', () => {
  let wrapper: VueWrapper | undefined;
  afterEach(() => wrapper?.unmount());

  function mountPage(onImages: (files: File[]) => void) {
    wrapper = mount(
      defineComponent({
        setup() {
          usePasteImages(onImages);
          return () => h('div', [h('input', { type: 'url' }), h('button', 'open')]);
        },
      }),
      { attachTo: document.body },
    );
    return wrapper;
  }

  function paste(target: EventTarget, data: DataTransfer) {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: data });
    target.dispatchEvent(event);
    return event;
  }

  it('hands pasted images to the page and stops the default paste', () => {
    const onImages = vi.fn();
    const page = mountPage(onImages);
    const event = paste(page.find('button').element, clipboard([png()]));
    expect(onImages).toHaveBeenCalledWith([expect.any(File)]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('lets text be pasted into a text field', () => {
    const onImages = vi.fn();
    const page = mountPage(onImages);
    const event = paste(page.find('input').element, clipboard([png()], ['Files', 'text/plain']));
    expect(onImages).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('still takes an image pasted while a text field has focus but no text is on the clipboard', () => {
    const onImages = vi.fn();
    const page = mountPage(onImages);
    paste(page.find('input').element, clipboard([png()]));
    expect(onImages).toHaveBeenCalledTimes(1);
  });

  it('ignores a clipboard without images', () => {
    const onImages = vi.fn();
    const page = mountPage(onImages);
    const event = paste(page.find('button').element, clipboard([], ['text/plain']));
    expect(onImages).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('stops listening once the page is unmounted', () => {
    const onImages = vi.fn();
    mountPage(onImages).unmount();
    wrapper = undefined;
    paste(document.body, clipboard([png()]));
    expect(onImages).not.toHaveBeenCalled();
  });
});
