import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';

const render = (text: string): string => renderToStaticMarkup(<Markdown text={text} />);

describe('Markdown', () => {
  it('ritar fetstil, kursiv, kod och länkar som öppnas i webbläsaren', () => {
    const html = render('**Bold**, *italic*, `code` and [docs](https://example.com)');
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('href="https://example.com" target="_blank" rel="noreferrer"');
  });

  it('gör rubriker till h3 och h4 under vyns egen rubrik', () => {
    const html = render('# One\n## Two\n### Three');
    expect(html.replaceAll('\n', '')).toContain('<h3>One</h3><h3>Two</h3><h4>Three</h4>');
  });

  it('ritar tabeller, kodblock och länkar utan klamrar', () => {
    const html = render(
      '| a | b |\n| - | - |\n| 1 | 2 |\n\n```ts\nconst x = 1;\n```\n\nhttps://yart.dev',
    );
    expect(html).toContain('<table>');
    expect(html).toContain('<pre><code class="language-ts">');
    expect(html).toContain('href="https://yart.dev"');
  });

  it('visar rå HTML som text och tar bort farliga länkar', () => {
    const html = render('<img src=x onerror=alert(1)> [x](javascript:alert(1))');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('javascript:');
  });
});
