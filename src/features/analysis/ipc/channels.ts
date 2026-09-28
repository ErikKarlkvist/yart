import { defineChannel, defineEvent } from '@/common/ipc/channel';
import { type SavedAnalysis } from '../model/analysis';

/** Alla analyser för ett repo, inbyggda först och sedan sparade, nyast först. */
export const listAnalysesChannel = defineChannel<{ repoPath: string }, SavedAnalysis[]>(
  'analysis:list',
);

export const deleteAnalysisChannel = defineChannel<
  { repoPath: string; id: string },
  SavedAnalysis[]
>('analysis:delete');

/**
 * Börjar bevaka `.reverik/` i repot och skriver guiden AI:n läser.
 * Anropas när ett repo väljs. Resultatet av importer kommer som `inboxEvent`.
 */
export const watchInboxChannel = defineChannel<{ repoPath: string }>('analysis:watch');

/** Vägen en analys kom in: en fil i inkorgen eller ett MCP-anrop från en agent. */
export type ImportVia =
  { kind: 'file'; file: string } | { kind: 'mcp'; tool: string; client: string };

export type InboxEvent =
  | {
      type: 'imported';
      repoPath: string;
      via: ImportVia;
      analysis: SavedAnalysis;
      /** Hela listan efter importen, så renderern slipper hämta om */
      list: SavedAnalysis[];
      /** Från skanningen när repot öppnas, inte en fil som just sparades */
      initial: boolean;
    }
  | { type: 'rejected'; repoPath: string; via: ImportVia; errors: string[] };

export const inboxEvent = defineEvent<InboxEvent>('analysis:inbox');
