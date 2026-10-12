import { describe, expect, it } from 'vitest';
import { type Flow } from '@/common/model/flow';
import { type Chunk, type FileDiff } from './diff';
import { groupChunks } from './group';

const flow: Flow = {
  question: 'q',
  title: 'Add todo',
  summary: 's',
  trigger: { kind: 'user', label: 'User clicks Add', nodeId: 'form' },
  systems: [{ id: 'app', label: 'App', kind: 'app' }],
  nodes: [
    { id: 'form', kind: 'ui', system: 'app', label: 'Form', source: { file: 'ui.ts', line: 5 } },
    {
      id: 'service',
      kind: 'service',
      system: 'app',
      label: 'Service',
      source: { file: 'service.ts', line: 10, endLine: 30 },
    },
    { id: 'db', kind: 'db', system: 'app', label: 'DB' },
  ],
  edges: [
    {
      id: 'submit',
      from: 'form',
      to: 'service',
      label: 'submit',
      source: { file: 'ui.ts', line: 9 },
    },
    {
      id: 'insert',
      from: 'service',
      to: 'db',
      label: 'INSERT',
      source: { file: 'service.ts', line: 20 },
    },
  ],
  steps: [
    { edgeId: 'submit', description: 'd' },
    { edgeId: 'insert', description: 'd' },
  ],
};

const base: Flow = {
  ...flow,
  edges: [
    ...flow.edges,
    {
      id: 'old',
      from: 'service',
      to: 'db',
      label: 'old call',
      source: { file: 'gone.ts', line: 3 },
    },
  ],
  steps: [...flow.steps, { edgeId: 'old', description: 'd' }],
};

function chunk(
  file: string,
  newStart: number,
  newLines = 3,
  oldStart = newStart,
  oldLines = newLines,
): Chunk {
  return {
    id: `${file}@${newStart}`,
    file,
    oldStart,
    oldLines,
    newStart,
    newLines,
    heading: '',
    lines: [],
  };
}

function fileDiff(file: string, ...chunks: Chunk[]): FileDiff {
  return { file, status: 'modified', binary: false, chunks };
}

const files: FileDiff[] = [
  fileDiff('README.md', chunk('README.md', 1)),
  fileDiff('service.ts', chunk('service.ts', 25), chunk('service.ts', 18)),
  fileDiff('ui.ts', chunk('ui.ts', 8), chunk('ui.ts', 4)),
  fileDiff('gone.ts', chunk('gone.ts', 0, 0, 1, 5)),
];

describe('groupChunks', () => {
  const groups = groupChunks(files, [{ name: 'add-todo', title: flow.title, flow, base }]);

  it('lägger flödets chunks i stegordning och resten sist', () => {
    expect(groups.map((g) => g.flow?.name ?? null)).toEqual(['add-todo', null]);
    expect(groups[0]?.chunks.map((c) => [c.chunk.id, c.place?.index, c.place?.label])).toEqual([
      ['ui.ts@4', 0, 'User clicks Add'],
      ['ui.ts@8', 1, 'submit'],
      ['service.ts@18', 1, 'submit'],
      ['service.ts@25', 1, 'submit'],
      ['gone.ts@0', 3, 'old call'],
    ]);
    expect(groups[1]?.chunks.map((c) => c.chunk.id)).toEqual(['README.md@1']);
  });

  it('ger en chunk till första flödet och nämner de andra', () => {
    const twice = groupChunks(files, [
      { name: 'a', title: 'A', flow },
      { name: 'b', title: 'B', flow },
    ]);
    expect(twice[0]?.chunks.map((c) => c.alsoIn)).toEqual([['B'], ['B'], ['B'], ['B']]);
    expect(twice[1]?.chunks).toEqual([]);
  });

  it('utelämnar gruppen för övrigt när allt hör till ett flöde', () => {
    const only = groupChunks(
      [fileDiff('ui.ts', chunk('ui.ts', 8))],
      [{ name: 'a', title: 'A', flow }],
    );
    expect(only).toHaveLength(1);
  });
});
