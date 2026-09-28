import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeRepo } from '@/common/main/git.test';
import { type Flow } from '@/common/model/flow';
import { DOCUMENTS_DIR, FLOWS_DIR, GUIDE_FILE, GUIDE_VERSION, REVIEWS_DIR } from '../model/guide';
import { importFlowFile, writeGuide } from './inbox';
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

describe('importFlowFile', () => {
  let repo: string;
  let store: AnalysisStore;

  beforeEach(async () => {
    repo = await mkdtemp(join(tmpdir(), 'reverik-inbox-'));
    await writeFile(join(repo, 'a.ts'), 'line1\nline2\nline3\n');
    await writeFile(join(repo, 'b.ts'), 'only line');
    await mkdir(join(repo, FLOWS_DIR), { recursive: true });
    await mkdir(join(repo, DOCUMENTS_DIR), { recursive: true });
    await mkdir(join(repo, REVIEWS_DIR), { recursive: true });
    store = new AnalysisStore(join(repo, '.store'));
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  async function put(name: string, content: unknown): Promise<void> {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    await writeFile(join(repo, FLOWS_DIR, name), text);
  }

  it('imports a valid flow under the file name', async () => {
    await put('click.json', flow);
    const result = await importFlowFile(store, repo, 'click.json');
    expect(result.type).toBe('imported');
    const list = await store.list(repo);
    expect(list).toHaveLength(1);
    expect(list[0]?.file).toBe(`${FLOWS_DIR}/click.json`);
    expect(list[0]?.name).toBe('click');
    expect(list[0]?.kind).toBe('flow');
    if (list[0]?.kind === 'flow') expect(list[0].flow.title).toBe('Click');
  });

  it('imports a document and turns legacy flow paths into names', async () => {
    const document = {
      title: 'Seat availability',
      summary: 'The web app asks the API for open seats.',
      content: 'The page requests availability for a selected date. The API checks bookings.',
      flowFiles: [`${FLOWS_DIR}/click.json`],
    };
    await writeFile(join(repo, DOCUMENTS_DIR, 'overview.json'), JSON.stringify(document));

    const result = await importFlowFile(store, repo, 'overview.json', 'document');

    expect(result.type).toBe('imported');
    if (result.type !== 'imported' || result.analysis.kind !== 'document')
      throw new Error('expected document');
    expect(result.analysis.document.title).toBe('Seat availability');
    expect(result.analysis.file).toBe(`${DOCUMENTS_DIR}/overview.json`);
    expect(result.analysis.name).toBe('overview');
    expect(result.analysis.document.flows).toEqual(['click']);
  });

  it('replaces the analysis when the same file is saved again', async () => {
    await put('click.json', flow);
    const first = await importFlowFile(store, repo, 'click.json');
    await put('click.json', { ...flow, title: 'Click again' });
    const second = await importFlowFile(store, repo, 'click.json');
    expect(second.type).toBe('imported');
    if (first.type !== 'imported' || second.type !== 'imported') throw new Error('expected import');
    expect(second.analysis.id).toBe(first.analysis.id);
    expect(await store.list(repo)).toHaveLength(1);
  });

  it('reports unchanged when the content is already imported', async () => {
    await put('click.json', flow);
    await importFlowFile(store, repo, 'click.json');
    expect((await importFlowFile(store, repo, 'click.json')).type).toBe('unchanged');
  });

  it('rejects invalid JSON and writes the errors next to the file', async () => {
    await put('broken.json', '{ not json');
    const result = await importFlowFile(store, repo, 'broken.json');
    expect(result.type).toBe('rejected');
    const errors = JSON.parse(
      await readFile(join(repo, FLOWS_DIR, 'broken.errors.json'), 'utf8'),
    ) as {
      errors: string[];
    };
    expect(errors.errors[0]).toMatch(/Not valid JSON/);
  });

  it('rejects schema errors and source references that do not exist', async () => {
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
    await put('bad.json', bad);
    const result = await importFlowFile(store, repo, 'bad.json');
    expect(result.type).toBe('rejected');
    if (result.type !== 'rejected') return;
    expect(result.errors).toEqual([
      expect.stringContaining('nope.ts does not exist'),
      expect.stringContaining('line 9 does not exist'),
    ]);
    expect(await store.list(repo)).toHaveLength(0);
  });

  it('removes a stale errors file once the flow is accepted', async () => {
    await put('click.json', '{');
    await importFlowFile(store, repo, 'click.json');
    await put('click.json', flow);
    await importFlowFile(store, repo, 'click.json');
    await expect(readFile(join(repo, FLOWS_DIR, 'click.errors.json'))).rejects.toThrow();
  });

  it('refuses source paths outside the repository', async () => {
    await put('escape.json', {
      ...flow,
      nodes: [{ ...flow.nodes[0], source: { file: '../a.ts', line: 1 } }, flow.nodes[1]],
    });
    const result = await importFlowFile(store, repo, 'escape.json');
    expect(result.type).toBe('rejected');
  });
});

describe('writeGuide', () => {
  it('skapar mappen när den saknas', async () => {
    const repo = await mkdtemp(join(tmpdir(), 'reverik-guide-'));
    try {
      await writeGuide(repo);
      expect(await readFile(join(repo, GUIDE_FILE), 'utf8')).toContain('reverik-guide');
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it('writes the guide with its version marker and rewrites an outdated copy', async () => {
    const repo = await mkdtemp(join(tmpdir(), 'reverik-guide-'));
    try {
      await mkdir(join(repo, '.reverik'), { recursive: true });
      await writeFile(join(repo, GUIDE_FILE), 'old');
      await writeGuide(repo);
      const guide = await readFile(join(repo, GUIDE_FILE), 'utf8');
      expect(guide).toContain(`reverik-guide v${GUIDE_VERSION}`);
      expect(guide).toContain('.reverik/flows/');
      expect(guide).toContain('.reverik/reviews/');
      expect(guide).toContain('"title": "Load the list"');
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });
});

describe('importFlowFile mot git', () => {
  it('kontrollerar en reviews head mot branchen även när den inte är utcheckad', async () => {
    const repo = await makeRepo();
    try {
      await mkdir(join(repo, REVIEWS_DIR), { recursive: true });
      const store = new AnalysisStore(join(repo, '.store'));
      const onFeature = {
        ...flow,
        nodes: [
          { ...flow.nodes[0], source: { file: 'b.txt', line: 3 } },
          { ...flow.nodes[1], source: { file: 'a.txt', line: 3 } },
        ],
        edges: [{ ...flow.edges[0], source: { file: 'b.txt', line: 1 } }],
      };
      await writeFile(
        join(repo, REVIEWS_DIR, 'feature.json'),
        JSON.stringify({
          baseLabel: 'main',
          headLabel: 'feature',
          base: {
            ...flow,
            nodes: [
              { ...flow.nodes[0], source: { file: 'a.txt', line: 1 } },
              { ...flow.nodes[1], source: { file: 'a.txt', line: 2 } },
            ],
            edges: [{ ...flow.edges[0], source: { file: 'a.txt', line: 1 } }],
          },
          head: onFeature,
          findings: [],
        }),
      );
      const result = await importFlowFile(store, repo, 'feature.json', 'review');
      expect(result.type).toBe('imported');
      if (result.type !== 'imported') return;
      expect(result.analysis.ref?.branch).toBe('feature');
      expect(result.analysis.ref?.commit).toMatch(/^[0-9a-f]{40}$/);
      if (result.analysis.kind === 'flow')
        expect(result.analysis.review?.baseCommit).toMatch(/^[0-9a-f]{40}$/);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it('avvisar en review vars head pekar på rader som inte finns på branchen', async () => {
    const repo = await makeRepo();
    try {
      await mkdir(join(repo, REVIEWS_DIR), { recursive: true });
      const store = new AnalysisStore(join(repo, '.store'));
      await writeFile(
        join(repo, REVIEWS_DIR, 'bad.json'),
        JSON.stringify({
          baseLabel: 'main',
          headLabel: 'feature',
          base: flow,
          head: {
            ...flow,
            nodes: [{ ...flow.nodes[0], source: { file: 'b.txt', line: 9 } }, flow.nodes[1]],
          },
          findings: [],
        }),
      );
      const result = await importFlowFile(store, repo, 'bad.json', 'review');
      expect(result.type).toBe('rejected');
      if (result.type !== 'rejected') return;
      expect(result.errors[0]).toContain('line 9 does not exist');
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });
});
