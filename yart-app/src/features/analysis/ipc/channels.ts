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

/** Vem som levererade: MCP-verktyget och klienten som anropade det. */
export interface DeliveredVia {
  tool: string;
  client: string;
  /** Konversationen i appen, när det är appens egen agent som levererar */
  conversationId?: string | undefined;
}

/** En agent har levererat en analys, eller fått den avvisad. */
export type DeliveryEvent =
  | {
      type: 'imported';
      repoPath: string;
      via: DeliveredVia;
      analysis: SavedAnalysis;
      /** Hela listan efter leveransen, så renderern slipper hämta om */
      list: SavedAnalysis[];
    }
  | { type: 'rejected'; repoPath: string; via: DeliveredVia; errors: string[] };

export const deliveryEvent = defineEvent<DeliveryEvent>('analysis:delivery');
