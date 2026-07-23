/**
 * Favicon SVGs based on Material Design Icons (@mdi/svg), Apache License 2.0.
 * https://github.com/Templarian/MaterialDesign
 */

import { extensionOf } from '@/config/app';
import hwpIconUrl from '@/assets/icons/hwp.png';

export type FaviconKind =
  | 'home'
  | 'pdf'
  | 'word'
  | 'excel'
  | 'powerpoint'
  | 'hwp'
  | 'sketch'
  | 'code'
  | 'diagram'
  | 'cad'
  | 'model3d'
  | 'scanner'
  | 'bgremove'
  | 'text'
  | 'csv'
  | 'file';

/** Shared filled document plate for letter-mark office icons. */
export const DOC_SHELL_PATH =
  'M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z';

export const ICON_PATHS: Record<FaviconKind, string> = {
  home: 'M9,13H15V19H18V10L12,5.5L6,10V19H9V13M4,21V9L12,3L20,9V21H4Z',
  pdf: DOC_SHELL_PATH,
  word: DOC_SHELL_PATH,
  excel: DOC_SHELL_PATH,
  powerpoint: DOC_SHELL_PATH,
  hwp: DOC_SHELL_PATH,
  sketch: 'M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25M20.71 7.04C21.1 6.65 21.1 6 20.71 5.63L18.37 3.29C18 2.9 17.35 2.9 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04Z',
  code: 'M8 3L6.59 4.41L10.17 8L6.59 11.59L8 13L13 8L8 3M14 11V13H22V11H14M5 19H19V17H5V19Z',
  diagram: 'M4 3H10V9H8V11H16V9H14V3H20V9H18V13H13V15H16V21H8V15H11V13H6V9H4V3M6 5V7H8V5H6M16 5V7H18V5H16M10 17V19H14V17H10Z',
  cad: 'M3 3H21V21H3V3M5 5V19H19V5H5M7 17V15H9V13H11V11H13V9H15V7H17V17H7Z',
  model3d: 'M12 2L21 7V17L12 22L3 17V7L12 2M12 4.3L5.4 8L12 11.7L18.6 8L12 4.3M5 9.7V15.8L11 19.1V13.1L5 9.7M13 19.1L19 15.8V9.7L13 13.1V19.1Z',
  scanner: 'M4 4H10V6H6V10H4V4M14 4H20V10H18V6H14V4M4 14H6V18H10V20H4V14M18 14H20V20H14V18H18V14M8 8H16V16H8V8Z',
  bgremove:
    'M19.36,2.72L20.78,4.14L15.06,9.85C16.13,11.39 16.28,13.24 15.38,14.44L9.06,8.12C10.26,7.22 12.11,7.37 13.65,8.44L19.36,2.72M5.93,17.57C3.92,15.56 2.69,13.16 2.35,10.92L7.23,8.83L14.67,16.27L12.58,21.15C10.34,20.81 7.94,19.58 5.93,17.57Z',
  text: 'M6,2A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6M6,4H13V9H18V20H6V4M8,12V14H16V12H8M8,16V18H13V16H8Z',
  csv: 'M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2M18 20H6V4H13V9H18V20M10 19L12 15H9V10H15V15L13 19H10',
  file: 'M6,2A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6M6,4H13V9H18V20H6V4M8,12V14H16V12H8M8,16V18H13V16H8Z',
};

/**
 * White glyphs drawn on `DOC_SHELL_PATH` (evenodd for letter counters).
 * Paths adapted from Material Design Icons (@mdi/svg), Apache-2.0.
 */
export const ICON_MARK_PATHS: Partial<Record<FaviconKind, string>> = {
  pdf:
    'M9.5,11.5C9.5,12.3 8.8,13 8,13H7V15H5.5V9H8C8.8,9 9.5,9.7 9.5,10.5V11.5M7,10.5H8V11.5H7V10.5Z' +
    'M14.5,13.5C14.5,14.3 13.8,15 13,15H10.5V9H13C13.8,9 14.5,9.7 14.5,10.5V13.5M12,10.5H13V13.5H12V10.5Z' +
    'M18.5,10.5H17V11.5H18.5V13H17V15H15.5V9H18.5V10.5Z',
  word: 'M15.5,17H14L12,9.5L10,17H8.5L6.1,7H7.8L9.34,14.5L11.3,7H12.7L14.67,14.5L16.2,7H17.9Z',
  excel:
    'M16.2,17H14.2L12,13.2L9.8,17H7.8L11,12L7.8,7H9.8L12,10.8L14.2,7H16.2L13,12Z',
  powerpoint:
    'M9.8,13.4H12.3C13.8,13.4 14.46,13.12 15.1,12.58C15.74,12.03 16,11.25 16,10.23C16,9.26 15.75,8.5 15.1,7.88C14.45,7.29 13.83,7 12.3,7H8V17H9.8V13.4M9.8,12V8.4H12.1C12.76,8.4 13.27,8.65 13.6,9C13.93,9.35 14.1,9.72 14.1,10.24C14.1,10.8 13.92,11.19 13.6,11.5C13.28,11.81 12.9,12 12.22,12H9.8Z',
};

/** Raster logo for Hangul (HWP) documents. */
export const HWP_ICON_URL = hwpIconUrl;

export const ICON_COLORS: Record<FaviconKind, string> = {
  home: '#0f6cbd',
  pdf: '#e53935',
  word: '#1e88e5',
  excel: '#43a047',
  powerpoint: '#fb8c00',
  hwp: '#34aee7',
  sketch: '#7b61a8',
  code: '#d97706',
  diagram: '#2e7d8a',
  cad: '#5c6bc0',
  model3d: '#6d4c41',
  scanner: '#00897b',
  bgremove: '#5c6bc0',
  text: '#607d8b',
  csv: '#00838f',
  file: '#546e7a',
};

const EXT_KIND: Record<string, FaviconKind> = {
  pdf: 'pdf',
  doc: 'word',
  docx: 'word',
  odt: 'word',
  rtf: 'word',
  dotx: 'word',
  xls: 'excel',
  xlsx: 'excel',
  ods: 'excel',
  xltx: 'excel',
  csv: 'csv',
  ppt: 'powerpoint',
  pptx: 'powerpoint',
  odp: 'powerpoint',
  potx: 'powerpoint',
  hwp: 'hwp',
  hwpx: 'hwp',
  excalidraw: 'sketch',
  mmd: 'code',
  mermaid: 'code',
  drawio: 'diagram',
  xml: 'diagram',
  dxf: 'cad',
  dwg: 'cad',
  '3dm': 'model3d',
  '3ds': 'model3d',
  '3mf': 'model3d',
  amf: 'model3d',
  bim: 'model3d',
  brp: 'model3d',
  brep: 'model3d',
  dae: 'model3d',
  fbx: 'model3d',
  fcstd: 'model3d',
  glb: 'model3d',
  gltf: 'model3d',
  ifc: 'model3d',
  igs: 'model3d',
  iges: 'model3d',
  stp: 'model3d',
  step: 'model3d',
  stl: 'model3d',
  obj: 'model3d',
  off: 'model3d',
  ply: 'model3d',
  wrl: 'model3d',
  zip: 'model3d',
  png: 'scanner',
  jpg: 'scanner',
  jpeg: 'scanner',
  webp: 'scanner',
  gif: 'scanner',
  bmp: 'scanner',
  bgremove: 'bgremove',
  txt: 'text',
};

export function iconSvgInner(kind: FaviconKind): string {
  const color = ICON_COLORS[kind];
  const mark = ICON_MARK_PATHS[kind];
  if (mark) {
    return (
      `<path fill="${color}" d="${ICON_PATHS[kind]}"/>` +
      `<path fill="#ffffff" fill-rule="evenodd" d="${mark}"/>`
    );
  }
  return `<path fill="${color}" d="${ICON_PATHS[kind]}"/>`;
}

function toDataUri(kind: FaviconKind): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${iconSvgInner(kind)}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const CACHE = new Map<FaviconKind, string>();

export function iconKindForExtension(ext: string): FaviconKind {
  return EXT_KIND[ext] ?? 'file';
}

export function faviconHrefForKind(kind: FaviconKind): string {
  if (kind === 'hwp') return HWP_ICON_URL;
  let href = CACHE.get(kind);
  if (!href) {
    href = toDataUri(kind);
    CACHE.set(kind, href);
  }
  return href;
}

export function faviconHrefFor(filename?: string | null): string {
  const name = filename?.trim();
  let kind: FaviconKind = 'home';
  if (name) {
    const ext = extensionOf(name);
    kind = ext ? (EXT_KIND[ext] ?? 'file') : 'home';
  }
  return faviconHrefForKind(kind);
}

export function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type =
    /\.png(?:\?|$)/i.test(href) || href.startsWith('data:image/png')
      ? 'image/png'
      : 'image/svg+xml';
  // Bust stubborn tab caches when switching between data URIs
  if (link.href !== href) {
    link.href = href;
  }
}
