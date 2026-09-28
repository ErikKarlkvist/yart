import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { app } from 'electron';
import { type AnalysisApi } from '@/features/analysis/main';
import { buildGuide } from '@/features/analysis/model/guide';
import { type SavedAnalysis } from '@/features/analysis/model/analysis';
import { type McpAnalysisSummary, type McpDeps } from '@/features/mcp/main/server';
import { openAndRemember, readRecent } from '@/features/repo/main';

/** Kopplar MCP-servern till analyserna och repolistan. */
export function mcpDeps(analyses: AnalysisApi): Omit<McpDeps, 'onActivity'> {
  return {
    version: app.getVersion(),
    guide: buildGuide,
    listRepos: async () =>
      (await readRecent()).map(({ path, name, branch }) => ({ path, name, branch })),
    resolveRepo: async (path) => {
      const repoPath = resolve(path);
      const info = await stat(repoPath).catch(() => null);
      if (!info?.isDirectory()) return null;
      const known = (await readRecent()).some((repo) => repo.path === repoPath);
      if (!known) await openAndRemember(repoPath);
      return repoPath;
    },
    listAnalyses: async (repoPath) => (await analyses.list(repoPath)).map(summarise),
    getAnalysis: async (repoPath, kind, name) => {
      const analysis = await analyses.get(repoPath, kind, name);
      if (!analysis) return null;
      return analysis.kind === 'flow'
        ? { flow: analysis.flow, ...(analysis.review ? { review: analysis.review } : {}) }
        : { document: analysis.document };
    },
    deliver: async (repoPath, kind, name, content, via) => {
      const result = await analyses.deliver(repoPath, kind, name, content, { kind: 'mcp', ...via });
      if (result.type === 'rejected') return { ok: false, errors: result.errors };
      return {
        ok: true,
        title: titleOf(result.analysis),
        changed: result.type === 'imported',
      };
    },
  };
}

function titleOf(analysis: SavedAnalysis): string {
  return analysis.kind === 'flow' ? analysis.flow.title : analysis.document.title;
}

function summarise(analysis: SavedAnalysis): McpAnalysisSummary {
  const ref = analysis.ref ? { ref: analysis.ref } : {};
  if (analysis.kind === 'document') {
    return {
      name: analysis.name,
      kind: 'document',
      title: analysis.document.title,
      summary: analysis.document.summary,
      ...ref,
    };
  }
  const review = analysis.review
    ? {
        review: {
          baseLabel: analysis.review.baseLabel,
          headLabel: analysis.review.headLabel,
          findings: analysis.review.findings.length,
        },
      }
    : {};
  return {
    name: analysis.name,
    kind: 'flow',
    title: analysis.flow.title,
    summary: analysis.flow.summary,
    ...review,
    ...ref,
  };
}
