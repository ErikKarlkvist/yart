import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMO_REPO_RELATIVE_PATH, demoFlows } from '@/common/model/fixtures';

const DEMO_ROOT = resolve(import.meta.dirname, '../../..', DEMO_REPO_RELATIVE_PATH);

/** Fixturerna ska peka på rader som faktiskt finns i demo-repot. */
describe('demo-fixturernas källhänvisningar', () => {
  const lineCounts = new Map<string, number>();
  const lineCount = (file: string): number => {
    const cached = lineCounts.get(file);
    if (cached !== undefined) return cached;
    const count = readFileSync(resolve(DEMO_ROOT, file), 'utf8').split('\n').length;
    lineCounts.set(file, count);
    return count;
  };

  for (const flow of demoFlows) {
    it(`${flow.title}: alla filer och rader finns`, () => {
      const tables = flow.nodes.flatMap((n) => n.tables ?? []);
      const refs = [...flow.nodes, ...flow.edges, ...tables].flatMap((x) =>
        x.source ? [x.source] : [],
      );
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) {
        expect(ref.line, `${ref.file}:${ref.line}`).toBeLessThanOrEqual(lineCount(ref.file));
      }
    });
  }
});
