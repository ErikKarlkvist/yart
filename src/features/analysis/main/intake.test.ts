import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeRepo } from '@/common/main/git.test';
import { type Flow } from '@/common/model/flow';
import { intakeAnalysis } from './intake';
import { AnalysisStore } from './store';

/** Ett minimalt giltigt flöde där alla källor pekar på filer i testrepot. */
const flow: Flow = {
  question: 'What happens on click?',
  title: 'Click',
  summary: 'The button calls the API.',
  systems: [
    { id: 'web', kind: 'app', label: 'Web' },
    { id: 'api', kind: 'api', label: 'API' },
  ],
  nodes: [
    { id: 'button', kind: 'ui', system: 'web', label: 'Button', source: { file: 'a.ts', line: 2 } },
    {
      id: 'route',
      kind: 'http',
      system: 'api',
      label: 'POST /x',
      source: { file: 'b.ts', line: 1 },
    },
  ],
  edges: [
    {
      id: 'call',
      from: 'button',
      to: 'route',
      label: 'POST /x',
      source: { file: 'a.ts', line: 3 },
    },
  ],
  steps: [{ edgeId: 'call', description: 'The button posts.' }],
};

describe('intakeAnalysis', () => {
  let repo: string;
  let store: AnalysisStore;

  beforeEach(async () => {
    repo = await mkdtemp(join(tmpdir(), 'reverik-intake-'));
    await writeFile(join(repo, 'a.ts'), 'line1\nline2\nline3\n');
    await writeFile(join(repo, 'b.ts'), 'only line');
    store = new AnalysisStore(join(repo, '.store'));
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it('sparar ett giltigt flöde under namnet, med eller utan omslag', async () => {
    const bare = await intakeAnalysis(store, repo, 'flow', 'click', flow);
    expect(bare.type).toBe('imported');
    const wrapped = await intakeAnalysis(store, repo, 'flow', 'click', { flow });
    expect(wrapped.type).toBe('unchanged');
    const list = await store.list(repo);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'click', kind: 'flow', flow: { title: 'Click' } });
  });

  it('ersätter analysen med samma namn och behåller id', async () => {
    const first = await intakeAnalysis(store, repo, 'flow', 'click', flow);
    const second = await intakeAnalysis(store, repo, 'flow', 'click', {
      ...flow,
      title: 'Click again',
    });
    if (first.type !== 'imported' || second.type !== 'imported') throw new Error('expected import');
    expect(second.analysis.id).toBe(first.analysis.id);
    expect(await store.list(repo)).toHaveLength(1);
  });

  it('sparar ett dokument som länkar flöden per namn', async () => {
    const result = await intakeAnalysis(store, repo, 'document', 'overview', {
      title: 'Overview',
      summary: 'The web app asks the API.',
      content: 'The page requests availability.',
      flows: ['click'],
    });
    expect(result.type).toBe('imported');
    if (result.type !== 'imported' || result.analysis.kind !== 'document')
      throw new Error('expected document');
    expect(result.analysis.document.flows).toEqual(['click']);
  });

  it('avvisar schemafel och källhänvisningar som inte finns', async () => {
    const bad: Flow = {
      ...flow,
      nodes: [
        ...flow.nodes,
        {
          id: 'ghost',
          kind: 'service',
          system: 'api',
          label: 'Ghost',
          source: { file: 'nope.ts', line: 1 },
        },
        {
          id: 'far',
          kind: 'service',
          system: 'api',
          label: 'Far',
          source: { file: 'b.ts', line: 9 },
        },
      ],
    };
    const result = await intakeAnalysis(store, repo, 'flow', 'bad', bad);
    expect(result.type).toBe('rejected');
    if (result.type !== 'rejected') return;
    expect(result.errors).toEqual([
      expect.stringContaining('nope.ts does not exist'),
      expect.stringContaining('line 9 does not exist'),
    ]);
    expect(await store.list(repo)).toHaveLength(0);
    const broken = await intakeAnalysis(store, repo, 'flow', 'broken', { ...flow, steps: [] });
    expect(broken.type).toBe('rejected');
  });

  it('vägrar källsökvägar utanför repot', async () => {
    const result = await intakeAnalysis(store, repo, 'flow', 'escape', {
      ...flow,
      nodes: [{ ...flow.nodes[0], source: { file: '../a.ts', line: 1 } }, flow.nodes[1]],
    });
    expect(result.type).toBe('rejected');
  });
});

describe('intakeAnalysis mot git', () => {
  const onFeature = {
    ...flow,
    nodes: [
      { ...flow.nodes[0], source: { file: 'b.txt', line: 3 } },
      { ...flow.nodes[1], source: { file: 'a.txt', line: 3 } },
    ],
    edges: [{ ...flow.edges[0], source: { file: 'b.txt', line: 1 } }],
  };
  const onMain = {
    ...flow,
    nodes: [
      { ...flow.nodes[0], source: { file: 'a.txt', line: 1 } },
      { ...flow.nodes[1], source: { file: 'a.txt', line: 2 } },
    ],
    edges: [{ ...flow.edges[0], source: { file: 'a.txt', line: 1 } }],
  };
  const compare = { baseLabel: 'main', headLabel: 'feature', base: onMain };
  let repo: string;
  let store: AnalysisStore;

  beforeEach(async () => {
    repo = await makeRepo();
    store = new AnalysisStore(join(repo, '.store'));
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it('kontrollerar ett flöde med jämförelse mot branchen även när den inte är utcheckad', async () => {
    const result = await intakeAnalysis(store, repo, 'flow', 'feature', {
      flow: onFeature,
      compare,
    });
    expect(result.type).toBe('imported');
    if (result.type !== 'imported' || result.analysis.kind !== 'flow') return;
    expect(result.analysis.ref?.branch).toBe('feature');
    expect(result.analysis.ref?.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(result.analysis.compare?.baseCommit).toMatch(/^[0-9a-f]{40}$/);
  });

  it('avvisar ett flöde vars head pekar på rader som inte finns på branchen', async () => {
    const result = await intakeAnalysis(store, repo, 'flow', 'bad', {
      flow: {
        ...flow,
        nodes: [{ ...flow.nodes[0], source: { file: 'b.txt', line: 9 } }, flow.nodes[1]],
      },
      compare,
    });
    expect(result.type).toBe('rejected');
    if (result.type !== 'rejected') return;
    expect(result.errors[0]).toContain('line 9 does not exist');
  });

  it('tar emot en review när dess flöden är sparade och pekar ut fel mål', async () => {
    const review = {
      title: 'Feature',
      summary: 'What the change does.',
      content: 'A paragraph.',
      baseLabel: 'main',
      headLabel: 'feature',
      flows: ['feature'],
      findings: [
        {
          id: 'f1',
          severity: 'warning',
          title: 'Something',
          description: 'Why.',
          flow: 'feature',
          nodeId: 'button',
        },
      ],
    };
    const missing = await intakeAnalysis(store, repo, 'review', 'feature', review);
    expect(missing.type).toBe('rejected');
    if (missing.type === 'rejected') expect(missing.errors[0]).toContain('not saved');

    await intakeAnalysis(store, repo, 'flow', 'feature', { flow: onFeature, compare });
    const result = await intakeAnalysis(store, repo, 'review', 'feature', review);
    expect(result.type).toBe('imported');
    if (result.type !== 'imported' || result.analysis.kind !== 'review') return;
    expect(result.analysis.ref?.branch).toBe('feature');
    expect(result.analysis.review.headCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(result.analysis.review.baseCommit).toMatch(/^[0-9a-f]{40}$/);

    const bad = await intakeAnalysis(store, repo, 'review', 'feature', {
      ...review,
      findings: [{ ...review.findings[0], nodeId: 'ghost' }],
    });
    expect(bad.type).toBe('rejected');
    if (bad.type === 'rejected') expect(bad.errors[0]).toContain('node "ghost"');
  });
});
