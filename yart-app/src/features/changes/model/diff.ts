/**
 * En git-diff som data: filer med chunks, varje chunk med sina rader. Chunk är
 * det git kallar hunk, ett sammanhängande ändrat område med sammanhang runt.
 * Parsern läser unified diff som `git diff` skriver den.
 */

export type FileStatus = 'modified' | 'added' | 'deleted' | 'renamed';

type LineKind = 'context' | 'added' | 'removed';

interface DiffLine {
  kind: LineKind;
  text: string;
  /** Radnummer i base, saknas på tillagda rader */
  oldNumber?: number;
  /** Radnummer i head, saknas på borttagna rader */
  newNumber?: number;
}

export interface Chunk {
  /** Unikt inom diffen: fil och plats i head */
  id: string;
  /** Sökvägen i head, eller i base för en borttagen fil */
  file: string;
  /** Första raden chunken täcker i base och hur många */
  oldStart: number;
  oldLines: number;
  /** Första raden chunken täcker i head och hur många */
  newStart: number;
  newLines: number;
  /** Det git skriver efter radintervallen: funktionen chunken ligger i */
  heading: string;
  lines: DiffLine[];
}

export interface FileDiff {
  /** Sökvägen i head, eller i base för en borttagen fil */
  file: string;
  /** Sökvägen i base när filen bytt namn */
  oldFile?: string;
  status: FileStatus;
  binary: boolean;
  chunks: Chunk[];
}

const CHUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;

/** Läser `git diff` till filer och chunks. Tom text ger tom lista. */
export function parseUnifiedDiff(text: string): FileDiff[] {
  const files: FileDiff[] = [];
  let current: FileDiff | null = null;
  let chunk: Chunk | null = null;
  let oldNumber = 0;
  let newNumber = 0;

  for (const raw of text.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      current = { file: pathsFromHeader(raw).head, status: 'modified', binary: false, chunks: [] };
      files.push(current);
      chunk = null;
      continue;
    }
    if (!current) continue;

    if (chunk) {
      const kind = lineKind(raw);
      if (kind) {
        const text = raw.slice(1);
        if (kind === 'context') {
          chunk.lines.push({ kind, text, oldNumber: oldNumber++, newNumber: newNumber++ });
        } else if (kind === 'removed') {
          chunk.lines.push({ kind, text, oldNumber: oldNumber++ });
        } else {
          chunk.lines.push({ kind, text, newNumber: newNumber++ });
        }
        continue;
      }
      if (raw.startsWith('\\')) continue; // "\ No newline at end of file"
    }

    const header = CHUNK_HEADER.exec(raw);
    if (header) {
      oldNumber = Number(header[1]);
      newNumber = Number(header[3]);
      chunk = {
        id: `${current.file}@${newNumber}`,
        file: current.file,
        oldStart: oldNumber,
        oldLines: header[2] === undefined ? 1 : Number(header[2]),
        newStart: newNumber,
        newLines: header[4] === undefined ? 1 : Number(header[4]),
        heading: header[5] ?? '',
        lines: [],
      };
      current.chunks.push(chunk);
      continue;
    }

    chunk = null;
    if (raw.startsWith('new file mode')) current.status = 'added';
    else if (raw.startsWith('deleted file mode')) current.status = 'deleted';
    else if (raw.startsWith('rename from ')) {
      current.status = 'renamed';
      current.oldFile = raw.slice('rename from '.length);
    } else if (raw.startsWith('rename to ')) current.file = raw.slice('rename to '.length);
    else if (raw.startsWith('Binary files ')) current.binary = true;
    else if (raw.startsWith('--- ') && raw !== '--- /dev/null' && current.status !== 'renamed') {
      current.file = stripPrefix(raw.slice(4));
    } else if (raw.startsWith('+++ ') && raw !== '+++ /dev/null') {
      current.file = stripPrefix(raw.slice(4));
    }
  }
  return files;
}

function lineKind(raw: string): LineKind | null {
  if (raw.startsWith('+')) return 'added';
  if (raw.startsWith('-')) return 'removed';
  if (raw.startsWith(' ')) return 'context';
  return null;
}

/** Sökvägarna ur "diff --git a/x b/y". Mellanslag i namn är ovanliga; då tas sista "b/". */
function pathsFromHeader(line: string): { base: string; head: string } {
  const rest = line.slice('diff --git '.length);
  const split = rest.lastIndexOf(' b/');
  if (split < 0) return { base: rest, head: rest };
  return { base: stripPrefix(rest.slice(0, split)), head: rest.slice(split + 3) };
}

function stripPrefix(path: string): string {
  const trimmed = path.replace(/\t.*$/, '');
  return trimmed.startsWith('a/') || trimmed.startsWith('b/') ? trimmed.slice(2) : trimmed;
}

/** Raderna en chunk täcker i head. En chunk som bara tar bort täcker raden före. */
export function newRange(chunk: Chunk): { from: number; to: number } {
  return { from: chunk.newStart, to: chunk.newStart + Math.max(chunk.newLines, 1) - 1 };
}

/** Raderna en chunk täcker i base. */
export function oldRange(chunk: Chunk): { from: number; to: number } {
  return { from: chunk.oldStart, to: chunk.oldStart + Math.max(chunk.oldLines, 1) - 1 };
}
