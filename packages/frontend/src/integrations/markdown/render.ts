import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  gfm: true,
  breaks: true,
});

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node instanceof HTMLAnchorElement) {
    const href = node.getAttribute('href') ?? '';
    if (href.startsWith('#')) {
      node.removeAttribute('target');
      node.removeAttribute('rel');
      return;
    }
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export interface ResolveMarkdownRelativeLinksOptions {
  repoBaseUrl: string;
  branch?: string;
  overrides?: Record<string, string>;
}

const FENCE_RE = /^\s*(```|~~~)/;
const SCHEME_OR_ROOT_RE = /^(?:[a-zA-Z][a-zA-Z\d+.-]*:|#|\/)/;
const MARKDOWN_LINK_RE = /(!?)\[([^\]]+)\]\(([^)\s]+)(\s+(?:"[^"]*"|'[^']*'))?\)/g;

/**
 * Rewrite relative Markdown link destinations (outside fenced code blocks) to either
 * explicit overrides or GitHub `blob/<branch>/...` URLs.
 */
export function resolveMarkdownRelativeLinks(
  source: string,
  options: ResolveMarkdownRelativeLinksOptions,
): string {
  const cleanBase = options.repoBaseUrl.replace(/\/+$/, '');
  const branch = options.branch || 'main';
  const overrides = options.overrides ?? {};

  let inFence = false;
  let fenceMarker = '';

  return (source ?? '')
    .split('\n')
    .map((line) => {
      const fenceMatch = line.match(FENCE_RE);
      if (fenceMatch) {
        const marker = fenceMatch[1];
        if (!inFence) {
          inFence = true;
          fenceMarker = marker;
        } else if (marker[0] === fenceMarker[0]) {
          inFence = false;
          fenceMarker = '';
        }
        return line;
      }

      if (inFence) return line;

      return line.replace(
        MARKDOWN_LINK_RE,
        (full, bang: string, label: string, dest: string, title = '') => {
          if (bang) return full;
          if (Object.prototype.hasOwnProperty.call(overrides, dest)) {
            return `[${label}](${overrides[dest]}${title})`;
          }
          if (SCHEME_OR_ROOT_RE.test(dest) || !cleanBase) {
            return full;
          }
          const cleanPath = dest.replace(/^\.\//, '');
          return `[${label}](${cleanBase}/blob/${branch}/${cleanPath}${title})`;
        },
      );
    })
    .join('\n');
}

export function renderMarkdown(source: string): string {
  const html = marked.parse(source ?? '', { async: false });
  return DOMPurify.sanitize(typeof html === 'string' ? html : '', {
    USE_PROFILES: { html: true },
  });
}

export function isMarkdownFile(file: File) {
  return (
    file.type === 'text/markdown' ||
    file.type === 'text/x-markdown' ||
    /\.(?:md|markdown|mdown)$/i.test(file.name)
  );
}
