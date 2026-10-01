import { z } from 'zod';
import { AGENT_KINDS } from '@/common/model/agent';

const agentEntrySchema = z.discriminatedUnion('kind', [
  z.object({ at: z.string(), kind: z.literal('user'), text: z.string() }),
  z.object({ at: z.string(), kind: z.literal('assistant'), text: z.string() }),
  z.object({ at: z.string(), kind: z.literal('tool'), name: z.string() }),
  z.object({ at: z.string(), kind: z.literal('error'), text: z.string() }),
]);

const CONVERSATION_MODES = ['analyse', 'review', 'plan', 'general'] as const;
export type ConversationMode = (typeof CONVERSATION_MODES)[number];
const reviewBranchesSchema = z.object({ head: z.string().min(1), base: z.string().min(1) });
export type ReviewBranches = z.infer<typeof reviewBranchesSchema>;

export const conversationSummarySchema = z.object({
  id: z.uuid(),
  repoPath: z.string(),
  agent: z.enum(AGENT_KINDS),
  mode: z.enum(CONVERSATION_MODES).default('general'),
  reviewBranches: reviewBranchesSchema.optional(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const conversationSchema = conversationSummarySchema.extend({
  entries: z.array(agentEntrySchema),
  threadId: z.string().nullable(),
});

export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
export type Conversation = z.infer<typeof conversationSchema>;
