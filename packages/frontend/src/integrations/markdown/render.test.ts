import { describe, expect, it } from 'vitest';
import { renderMarkdown, resolveMarkdownRelativeLinks } from './render';

describe('renderMarkdown', () => {
  it('adds target="_blank" and rel="noopener noreferrer" to external links', () => {
    const html = renderMarkdown('[GitHub](https://github.com/sejongY00/sejong-office)');
    const container = document.createElement('div');
    container.innerHTML = html;
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe(
      'https://github.com/sejongY00/sejong-office',
    );
    expect(anchor?.getAttribute('target')).toBe('_blank');
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('keeps in-page anchor links without target="_blank"', () => {
    const html = renderMarkdown('[GPL](#gpl-license)');
    const container = document.createElement('div');
    container.innerHTML = html;
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('#gpl-license');
    expect(anchor?.hasAttribute('target')).toBe(false);
    expect(anchor?.hasAttribute('rel')).toBe(false);
  });

  it('sanitizes dangerous scripts and inline event handlers', () => {
    const html = renderMarkdown(
      'Hello <script>alert(1)</script><img src="x" onerror="alert(2)">',
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
  });
});

describe('resolveMarkdownRelativeLinks', () => {
  const repoBaseUrl = 'https://github.com/sejongY00/sejong-office';

  it('applies explicit overrides and rewrites relative paths to GitHub blob URLs', () => {
    const input = [
      'See [LICENSE](./LICENSE) and [patch](./packages/desktop/src/koreanFontsPatch.cjs).',
      'External: [Repo](https://github.com/sejongY00/document), [Anchor](#sec), ![Img](./logo.png).',
    ].join('\n');

    const output = resolveMarkdownRelativeLinks(input, {
      repoBaseUrl,
      overrides: { './LICENSE': '#gpl-license' },
    });

    expect(output).toContain('[LICENSE](#gpl-license)');
    expect(output).toContain(
      '[patch](https://github.com/sejongY00/sejong-office/blob/main/packages/desktop/src/koreanFontsPatch.cjs)',
    );
    expect(output).toContain('[Repo](https://github.com/sejongY00/document)');
    expect(output).toContain('[Anchor](#sec)');
    expect(output).toContain('![Img](./logo.png)');
  });

  it('ignores links inside fenced code blocks', () => {
    const input = [
      '```md',
      '[LICENSE](./LICENSE)',
      '[Rel](./some/file.ts)',
      '```',
      '[Real](./README.md)',
    ].join('\n');

    const output = resolveMarkdownRelativeLinks(input, {
      repoBaseUrl,
      overrides: { './LICENSE': '#gpl-license' },
    });

    expect(output).toContain('```md\n[LICENSE](./LICENSE)\n[Rel](./some/file.ts)\n```');
    expect(output).toContain(
      '[Real](https://github.com/sejongY00/sejong-office/blob/main/README.md)',
    );
  });
});
