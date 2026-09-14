import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  gfm: true,
  breaks: true,
});

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node instanceof HTMLAnchorElement) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

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
