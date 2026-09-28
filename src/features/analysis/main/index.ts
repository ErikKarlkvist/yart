import { join } from 'node:path';
import { app } from 'electron';
import { emitEvent, handleChannel } from '@/common/main/ipc';
import {
  deleteAnalysisChannel,
  type DeliveredVia,
  deliveryEvent,
  listAnalysesChannel,
} from '../ipc/channels';
import { type SavedAnalysis } from '../model/analysis';
import { builtinAnalyses } from './builtin';
import { intakeAnalysis, type IntakeKind, type IntakeResult } from './intake';
import { AnalysisStore } from './store';

/** Det MCP-servern får göra med analyserna. */
export interface AnalysisApi {
  list: (repoPath: string) => Promise<SavedAnalysis[]>;
  get: (
    repoPath: string,
    kind: SavedAnalysis['kind'],
    name: string,
  ) => Promise<SavedAnalysis | null>;
  /** Validerar, sparar och berättar för renderern. */
  deliver: (
    repoPath: string,
    kind: IntakeKind,
    name: string,
    json: unknown,
    via: DeliveredVia,
  ) => Promise<IntakeResult>;
}

export function registerAnalysisHandlers(): AnalysisApi {
  const store = new AnalysisStore(join(app.getPath('userData'), 'analyses'));
  const listAll = async (repoPath: string): Promise<SavedAnalysis[]> => [
    ...builtinAnalyses(repoPath),
    ...(await store.list(repoPath)),
  ];

  handleChannel(listAnalysesChannel, ({ repoPath }) => listAll(repoPath));
  handleChannel(deleteAnalysisChannel, async ({ repoPath, id }) => {
    await store.delete(repoPath, id);
    return listAll(repoPath);
  });

  return {
    list: listAll,
    get: async (repoPath, kind, name) =>
      (await listAll(repoPath)).find((a) => a.kind === kind && a.name === name) ?? null,
    deliver: async (repoPath, kind, name, json, via) => {
      const result = await intakeAnalysis(store, repoPath, kind, name, json);
      if (result.type === 'imported') {
        emitEvent(deliveryEvent, {
          type: 'imported',
          repoPath,
          via,
          analysis: result.analysis,
          list: await listAll(repoPath),
        });
      } else if (result.type === 'rejected') {
        emitEvent(deliveryEvent, { type: 'rejected', repoPath, via, errors: result.errors });
      }
      return result;
    },
  };
}
