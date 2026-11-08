// Office/PDF files open in the browser-only editor (ranuts/document) in a new tab. The editor needs
// cross-origin isolation headers to accept files from an embedding page, which GitHub Pages cannot
// send, so the file cannot be handed over: the user picks it again in the editor tab. This module
// only remembers the chosen name for the hand-off page.
import { OFFICE_EDITOR_URL } from '@/config/app';

let pendingName = '';
let token = 0;

export function stageOfficeName(name: string): void {
  pendingName = name;
  token += 1;
}

/** Changes on every staged document so the keep-alive view remounts. */
export function officeOpenToken(): number {
  return token;
}

export function consumeOfficeName(): string {
  const name = pendingName;
  pendingName = '';
  return name;
}

export type OfficeBlankType = 'docx' | 'xlsx' | 'pptx';

/** Editor URL: a blank document of `blank`, or the editor's open screen. */
export function officeEditorUrl(blank?: OfficeBlankType): string {
  const url = new URL('editor', OFFICE_EDITOR_URL);
  url.searchParams.set('locale', 'ko');
  if (blank) url.searchParams.set('new', blank);
  return url.toString();
}

/** Must run inside the click handler itself: browsers only allow window.open on a user gesture. */
export function openOfficeEditor(blank?: OfficeBlankType): boolean {
  return window.open(officeEditorUrl(blank), '_blank', 'noopener') !== null;
}
