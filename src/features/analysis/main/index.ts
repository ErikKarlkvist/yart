import { join } from 'node:path';
import { app } from 'electron';
import { emitEvent, handleChannel } from '@/common/main/ipc';
import {
  deleteAnalysisChannel,
  type ImportVia,
  inboxEvent,
  listAnalysesChannel,
  watchInboxChannel,
} from '../ipc/channels';
import { type SavedAnalysis } from '../model/analysis';
import { builtinAnalyses } from './builtin';
import { FlowInbox } from './inbox';
import { intakeAnalysis, type IntakeKind, type IntakeResult } from './intake';
import { AnalysisStore } from './store';

/** Det andra features, i praktiken MCP-servern, får göra med analyserna. */
export interface AnalysisApi {
  list: (repoPath: string) => Promise<SavedAnalysis[]>;
  get: (
    repoPath: string,
    kind: SavedAnalysis['kind'],
    name: string,
  ) => Promise<SavedAnalysis | null>;
  /** Validerar, sparar och berättar för renderern, som när en fil landar i inkorgen. */
  deliver: (
    repoPath: string,
    kind: IntakeKind,
    name: string,
    json: unknown,
    via: ImportVia,
  ) => Promise<IntakeResult>;
}

export function registerAnalysisHandlers(): AnalysisApi {
  const store = new AnalysisStore(join(app.getPath('userData'), 'analyses'));
  const listAll = async (repoPath: string): Promise<SavedAnalysis[]> => [
    ...builtinAnalyses(repoPath),
    ...(await store.list(repoPath)),
  ];
  const inbox = new FlowInbox(store, listAll, (event) => {
    emitEvent(inboxEvent, event);
  });

  handleChannel(listAnalysesChannel, ({ repoPath }) => listAll(repoPath));
  handleChannel(deleteAnalysisChannel, async ({ repoPath, id }) => {
    await store.delete(repoPath, id);
    return listAll(repoPath);
  });
  handleChannel(watchInboxChannel, ({ repoPath }) => inbox.watch(repoPath));

  app.on('before-quit', () => {
    inbox.stop();
  });

  return {
    list: listAll,
    get: async (repoPath, kind, name) =>
      (await listAll(repoPath)).find((a) => a.kind === kind && a.name === name) ?? null,
    deliver: async (repoPath, kind, name, json, via) => {
      const result = await intakeAnalysis(store, repoPath, kind, name, json);
      if (result.type === 'imported') {
        emitEvent(inboxEvent, {
          type: 'imported',
          repoPath,
          via,
          analysis: result.analysis,
          list: await listAll(repoPath),
          initial: false,
        });
      } else if (result.type === 'rejected') {
        emitEvent(inboxEvent, { type: 'rejected', repoPath, via, errors: result.errors });
      }
      return result;
    },
  };
}

export { writeGuide } from './inbox';
