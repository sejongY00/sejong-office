import { describe, expect, it } from 'vitest';
import {
  APP_GIT_URL,
  APP_LATEST_RELEASE_URL,
  diagramKindFor,
  extensionOf,
  isHwp,
  isOffice,
  isScannerImage,
  toolKindFor,
  viewerKindFor,
} from './app';

describe('release URL config', () => {
  it('points APP_LATEST_RELEASE_URL to the latest GitHub release page', () => {
    expect(APP_GIT_URL).toBe('https://github.com/sejongY00/sejong-office');
    expect(APP_LATEST_RELEASE_URL).toBe(
      'https://github.com/sejongY00/sejong-office/releases/latest',
    );
  });
});

describe('extensionOf', () => {
  it.each([
    ['보고서.HWPX', 'hwpx'],
    ['archive.tar.gz', 'gz'],
    ['README', ''],
    ['.env', 'env'],
  ])('%s → %s', (name, ext) => {
    expect(extensionOf(name)).toBe(ext);
  });
});

describe('which screen opens a file', () => {
  it.each(['a.hwp', 'b.HWPX'])('%s goes to the HWP editor', (name) => {
    expect(isHwp(name)).toBe(true);
    expect(isOffice(name)).toBe(false);
  });

  it.each(['a.docx', 'b.xlsx', 'c.pptx', 'd.pdf', 'e.csv', 'f.doc', 'g.dotx'])(
    '%s goes to the office editor',
    (name) => {
      expect(isOffice(name)).toBe(true);
    },
  );

  it.each([
    ['a.excalidraw', 'excalidraw'],
    ['a.mmd', 'mermaid'],
    ['a.mermaid', 'mermaid'],
    ['a.drawio', 'drawio'],
    ['a.xml', 'drawio'],
  ])('%s opens the %s editor', (name, kind) => {
    expect(diagramKindFor(name)).toBe(kind);
  });

  it.each([
    ['a.dwg', 'cad'],
    ['a.DXF', 'cad'],
    ['a.glb', 'model3d'],
    ['a.step', 'model3d'],
    ['a.zip', 'model3d'],
    ['a.ai', 'illustrator'],
    ['a.psd', 'photoshop'],
    ['a.md', 'markdown'],
  ])('%s opens the %s viewer', (name, kind) => {
    expect(viewerKindFor(name)).toBe(kind);
  });

  it.each([
    ['a.png', 'scanner'],
    ['a.JPEG', 'scanner'],
    ['a.ico', 'imageedit'],
  ])('%s opens the %s tool', (name, kind) => {
    expect(toolKindFor(name)).toBe(kind);
  });

  it('knows nothing about unrelated files', () => {
    for (const name of ['a.exe', 'a', 'a.mp4']) {
      expect(isHwp(name) || isOffice(name)).toBe(false);
      expect(diagramKindFor(name) ?? viewerKindFor(name) ?? toolKindFor(name)).toBeNull();
    }
  });

  it('treats only raster images as scanner input', () => {
    expect(isScannerImage('scan.webp')).toBe(true);
    expect(isScannerImage('logo.svg')).toBe(false);
  });
});
