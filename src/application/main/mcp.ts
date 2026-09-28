import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { app } from 'electron';
import { type AnalysisApi } from '@/features/analysis/main';
import { buildGuide, buildSkill } from '@/features/analysis/model/guide';
import { analysisTitle, type SavedAnalysis } from '@/features/analysis/model/analysis';
import { type McpRegistration } from '@/features/mcp/main';
import { type McpAnalysisSummary } from '@/features/mcp/main/server';
import { openAndRemember, readRecent } from '@/features/repo/main';

/** Kopplar MCP-servern till analyserna och repolistan. */
export function mcpDeps(analyses: AnalysisApi): McpRegistration {
  return {
    version: app.getVersion(),
    guide: buildGuide,
    skill: buildSkill,
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
      switch (analysis.kind) {
        case 'flow':
          return {
            flow: analysis.flow,
            ...(analysis.compare ? { compare: analysis.compare } : {}),
          };
        case 'document':
          return { document: analysis.document };
        case 'review':
          return { review: analysis.review };
      }
    },
    deliver: async (repoPath, kind, name, content, via) => {
      const result = await analyses.deliver(repoPath, kind, name, content, { kind: 'mcp', ...via });
      if (result.type === 'rejected') return { ok: false, errors: result.errors };
      return {
        ok: true,
        title: analysisTitle(result.analysis),
        changed: result.type === 'imported',
      };
    },
  };
}

function summarise(analysis: SavedAnalysis): McpAnalysisSummary {
  const ref = analysis.ref ? { ref: analysis.ref } : {};
  switch (analysis.kind) {
    case 'document':
      return {
        name: analysis.name,
        kind: 'document',
        title: analysis.document.title,
        summary: analysis.document.summary,
        ...ref,
      };
    case 'review':
      return {
        name: analysis.name,
        kind: 'review',
        title: analysis.review.title,
        summary: analysis.review.summary,
        review: {
          baseLabel: analysis.review.baseLabel,
          headLabel: analysis.review.headLabel,
          flows: analysis.review.flows,
          findings: analysis.review.findings.length,
        },
        ...ref,
      };
    case 'flow':
      return {
        name: analysis.name,
        kind: 'flow',
        title: analysis.flow.title,
        summary: analysis.flow.summary,
        ...(analysis.compare
          ? {
              compare: {
                baseLabel: analysis.compare.baseLabel,
                headLabel: analysis.compare.headLabel,
              },
            }
          : {}),
        ...ref,
      };
  }
}
