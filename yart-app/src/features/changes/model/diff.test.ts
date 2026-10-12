import { describe, expect, it } from 'vitest';
import { newRange, oldRange, parseUnifiedDiff, splitRows } from './diff';

const SAMPLE = [
  'diff --git a/backend/src/services/TodoService.ts b/backend/src/services/TodoService.ts',
  'index 1111111..2222222 100644',
  '--- a/backend/src/services/TodoService.ts',
  '+++ b/backend/src/services/TodoService.ts',
  '@@ -20,6 +20,7 @@ export class TodoService {',
  '   async create(input: CreateTodo): Promise<Todo> {',
  '+    await this.lists.exists(input.listId);',
  '     const todo = await this.repository.insert(input);',
  '-    await this.cache.invalidate();',
  '     await this.webhook.notify(todo);',
  '     return todo;',
  '   }',
  '@@ -40,3 +41,4 @@ export class TodoService {',
  '   remove(): void {}',
  '+  // more',
  ' }',
  '\\ No newline at end of file',
  'diff --git a/docs/new.md b/docs/new.md',
  'new file mode 100644',
  'index 0000000..3333333',
  '--- /dev/null',
  '+++ b/docs/new.md',
  '@@ -0,0 +1 @@',
  '+# New',
  'diff --git a/old.ts b/new.ts',
  'similarity index 90%',
  'rename from old.ts',
  'rename to new.ts',
  'diff --git a/logo.png b/logo.png',
  'index 4444444..5555555 100644',
  'Binary files a/logo.png and b/logo.png differ',
  '',
].join('\n');

describe('parseUnifiedDiff', () => {
  const files = parseUnifiedDiff(SAMPLE);

  it('ger en fil per diff-huvud med status', () => {
    expect(files.map((f) => [f.file, f.status, f.binary])).toEqual([
      ['backend/src/services/TodoService.ts', 'modified', false],
      ['docs/new.md', 'added', false],
      ['new.ts', 'renamed', false],
      ['logo.png', 'modified', true],
    ]);
    expect(files[2]?.oldFile).toBe('old.ts');
  });

  it('läser chunkens intervall och rubrik', () => {
    const chunk = files[0]?.chunks[0];
    expect(chunk).toMatchObject({
      oldStart: 20,
      oldLines: 6,
      newStart: 20,
      newLines: 7,
      heading: 'export class TodoService {',
      id: 'backend/src/services/TodoService.ts@20',
    });
    expect(files[0]?.chunks).toHaveLength(2);
  });

  it('numrerar raderna på båda sidor', () => {
    const lines = files[0]?.chunks[0]?.lines ?? [];
    expect(lines.map((l) => [l.kind, l.oldNumber, l.newNumber])).toEqual([
      ['context', 20, 20],
      ['added', undefined, 21],
      ['context', 21, 22],
      ['removed', 22, undefined],
      ['context', 23, 23],
      ['context', 24, 24],
      ['context', 25, 25],
    ]);
    expect(lines[1]?.text).toBe('    await this.lists.exists(input.listId);');
  });

  it('hoppar över markeringen för saknad radbrytning', () => {
    expect(files[0]?.chunks[1]?.lines).toHaveLength(3);
  });

  it('läser intervall utan radantal som en rad', () => {
    expect(files[1]?.chunks[0]).toMatchObject({ oldLines: 0, newStart: 1, newLines: 1 });
  });

  it('ger tom lista för tom diff', () => {
    expect(parseUnifiedDiff('')).toEqual([]);
  });
});

describe('splitRows', () => {
  it('ställer borttaget och tillagt bredvid varandra och fyller ut', () => {
    const chunk = parseUnifiedDiff(SAMPLE)[0]?.chunks[0];
    if (!chunk) throw new Error('chunk');
    expect(
      splitRows(chunk).map((r) => [r.old?.oldNumber ?? null, r.new?.newNumber ?? null]),
    ).toEqual([
      [20, 20],
      [null, 21],
      [21, 22],
      [22, null],
      [23, 23],
      [24, 24],
      [25, 25],
    ]);
  });
});

describe('ranges', () => {
  it('täcker minst en rad även när sidan är tom', () => {
    const chunk = parseUnifiedDiff(SAMPLE)[1]?.chunks[0];
    if (!chunk) throw new Error('chunk');
    expect(newRange(chunk)).toEqual({ from: 1, to: 1 });
    expect(oldRange(chunk)).toEqual({ from: 0, to: 0 });
  });
});
