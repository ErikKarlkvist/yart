/**
 * Den lilla del markdown dokument och reviewer skrivs i: rubriker, punktlistor,
 * numrerade listor, stycken, **fetstil** och `kod`. Tolkas till block så
 * renderern bygger element direkt, utan HTML-strängar.
 */

export interface InlinePart {
  kind: 'text' | 'strong' | 'code';
  text: string;
}

export type MarkdownBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; content: InlinePart[] }
  | { kind: 'paragraph'; content: InlinePart[] }
  | { kind: 'list'; ordered: boolean; items: InlinePart[][] };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

export function parseMarkdown(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];

  const flush = (): void => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', content: parseInline(paragraph.join(' ')) });
      paragraph = [];
    }
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      const hashes = heading[1]?.length ?? 1;
      // # och ## är avsnitt, ### underavsnitt, djupare slås ihop med den nivån
      const level = hashes <= 2 ? (hashes === 1 ? 1 : 2) : 3;
      blocks.push({ kind: 'heading', level, content: parseInline(heading[2] ?? '') });
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    const item = bullet ?? numbered;
    if (item) {
      flush();
      const ordered = numbered !== null;
      const last = blocks.at(-1);
      const content = parseInline(item[1] ?? '');
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(content);
      else blocks.push({ kind: 'list', ordered, items: [content] });
      continue;
    }
    // En indragen rad direkt efter en listpunkt fortsätter punkten
    const last = blocks.at(-1);
    if (paragraph.length === 0 && /^\s+/.test(raw) && last?.kind === 'list') {
      const items = last.items;
      const previous = items[items.length - 1] ?? [];
      items[items.length - 1] = [...previous, ...parseInline(` ${line.trim()}`)];
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

/** **fetstil** och `kod`. Allt annat är text, även omatchade tecken. */
export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let at = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > at) parts.push({ kind: 'text', text: text.slice(at, match.index) });
    if (match[1] !== undefined) parts.push({ kind: 'strong', text: match[1] });
    else if (match[2] !== undefined) parts.push({ kind: 'code', text: match[2] });
    at = match.index + match[0].length;
  }
  if (at < text.length) parts.push({ kind: 'text', text: text.slice(at) });
  return parts;
}
