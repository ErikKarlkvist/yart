/**
 * Formaterar payload-text för visning. Text som innehåller ett JSON-liknande
 * objekt eller en lista bryts upp med indrag. Formateraren är tolerant: den
 * kräver inte giltig JSON, så fixturernas "…" och modellens slarv går igenom.
 * Ett prefix före JSON, t.ex. "201 ", behålls på första raden.
 */
export function formatPayload(text: string): string {
  const start = text.search(/[[{]/);
  if (start === -1) return text;
  const prefix = text.slice(0, start).trimEnd();
  const json = text.slice(start);
  const pretty = prettify(json);
  return prefix ? `${prefix} ${pretty}` : pretty;
}

const INDENT = '  ';

function prettify(input: string): string {
  let out = '';
  let depth = 0;
  let inString = false;
  let quote = '';

  const newline = (): void => {
    out = out.trimEnd() + '\n' + INDENT.repeat(depth);
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i] ?? '';
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += input[i + 1] ?? '';
        i++;
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }
    switch (ch) {
      case '"':
      case "'":
        inString = true;
        quote = ch;
        out += ch;
        break;
      case '{':
      case '[': {
        const closing = ch === '{' ? '}' : ']';
        const rest = input.slice(i + 1).trimStart();
        if (rest.startsWith(closing)) {
          // Tomt objekt eller lista hålls på en rad
          out += ch + closing;
          i = input.indexOf(closing, i + 1);
        } else {
          out += ch;
          depth++;
          newline();
        }
        break;
      }
      case '}':
      case ']':
        depth = Math.max(0, depth - 1);
        newline();
        out += ch;
        break;
      case ',':
        out += ',';
        newline();
        break;
      case ' ':
      case '\n':
      case '\t':
        if (!out.endsWith(' ') && !out.endsWith('\n') && !/\s$/.test(out)) out += ' ';
        break;
      default:
        out += ch;
    }
  }
  return out.replace(/ +\n/g, '\n').trim();
}
