import { z } from 'zod';
import { brandText } from './brand';
import { t } from './i18n';

/**
 * Kontraktet mellan analysen (AI:n) och visualiseringen. AI:n producerar ett
 * Flow, UI:t ritar och spelar upp det. Befintlig kod spåras till en fil och
 * rad i repot; nya delar i en plan får sakna källa. Beskrivningarna är på engelska och
 * följer med i JSON-schemat som MCP-verktygen visar för modellen.
 */

export const nodeKindSchema = z
  .enum([
    /** Något användaren interagerar med: knapp, formulär, sida */
    'ui',
    /** Kod som reagerar på en händelse i klienten: handler, hook, action */
    'handler',
    /** HTTP-endpoint eller route i backend */
    'http',
    /** Intern tjänst, modul eller klass i backend */
    'service',
    /** Databas eller annan lagring */
    'db',
    /** Cache: Redis, minnescache, CDN */
    'cache',
    /** Externt system utanför repot: betaltjänst, tredjeparts-API */
    'external',
    /** Kö, topic eller eventbuss */
    'queue',
  ])
  .describe(
    'ui: something the user interacts with (button, form, page). handler: client code reacting to an event (handler, hook, action). http: HTTP endpoint or route in a backend. service: internal service, module or class in a backend. db: database or other storage. cache: Redis, in-memory cache, CDN. external: system outside the repository (payment provider, third-party API). queue: queue, topic or event bus.',
  );

/** Vilken sorts system en grupp noder tillhör. Visas i systemvyn. */
export const systemKindSchema = z
  .enum([
    /** Klientapplikation: webb, mobil, desktop */
    'app',
    /** Backend eller API-tjänst */
    'api',
    'db',
    'cache',
    'external',
    'queue',
  ])
  .describe(
    'app: client application (web, mobile, desktop). api: backend or API service. db, cache, external, queue: infrastructure or systems outside the repository.',
  );

const flowSystemSchema = z
  .object({
    id: z.string().min(1).describe('Unique within systems'),
    kind: systemKindSchema,
    label: z.string().min(1).describe('Short, e.g. "Web app", "API", "Postgres"'),
    description: z.string().optional(),
  })
  .describe(
    brandText(
      'One deployable application or infrastructure component: the frontend, the API, Postgres, Redis. {appName} shows the systems first and lets the user zoom into each one.',
    ),
  );

export const sourceRefSchema = z
  .object({
    file: z.string().min(1).describe('Path relative to the repository root'),
    line: z.number().int().positive().describe('1-based line number that exists in the file'),
    endLine: z.number().int().positive().optional(),
  })
  .describe(
    brandText(
      'A file and line that really exist in the repository. {appName} checks both and rejects the analysis otherwise.',
    ),
  );

const columnReferenceSchema = z.object({
  table: z.string().min(1).describe('A table on the same node'),
  column: z.string().min(1),
});

const tableColumnSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string().optional(),
  primaryKey: z.boolean().optional(),
  references: columnReferenceSchema
    .optional()
    .describe('Foreign key: the column points at a table on the same node'),
});

/** En tabell, collection eller nyckelrymd i en lagringsnod. */
const dataTableSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    columns: z.array(tableColumnSchema).optional(),
    source: sourceRefSchema
      .optional()
      .describe('Where the schema is defined, e.g. a migration or schema.sql'),
  })
  .describe('A table, collection or key space stored on a db or cache node');

const flowNodeSchema = z
  .object({
    id: z.string().min(1).describe('Unique within nodes'),
    kind: nodeKindSchema,
    system: z.string().min(1).describe('The system the node belongs to, a systems[].id'),
    label: z
      .string()
      .min(1)
      .describe("Short, using the code's own name: component, function, route, table"),
    role: z
      .string()
      .min(1)
      .optional()
      .describe('A more specific type label when useful, such as "Hook", "Action" or "Event"'),
    description: z.string().optional(),
    highlight: z
      .enum(['added', 'changed'])
      .optional()
      .describe(
        'For a proposed plan: added means a new component; changed means an existing component to update. Omit for current behavior and reviews with compare.',
      ),
    source: sourceRefSchema
      .optional()
      .describe(
        'Where the node is declared. Required unless kind is db, cache, external or queue, or highlight is added for a proposed component.',
      ),
    tables: z
      .array(dataTableSchema)
      .optional()
      .describe('What the node stores, mainly for db and cache nodes'),
  })
  .describe('A component the data passes through');

const flowEdgeSchema = z
  .object({
    id: z.string().min(1).describe('Unique within edges'),
    from: z.string().min(1).describe('A nodes[].id'),
    to: z.string().min(1).describe('A nodes[].id'),
    label: z.string().min(1).describe('Short, e.g. "POST /api/todos" or "INSERT todos"'),
    payload: z.string().optional().describe('What is sent: free text or example JSON'),
    response: z.string().optional().describe('What comes back, if anything'),
    highlight: z
      .enum(['added', 'changed'])
      .optional()
      .describe(
        'For a proposed plan: added means a new call; changed means an existing call to update. Omit for current behavior and reviews with compare.',
      ),
    source: sourceRefSchema
      .optional()
      .describe(
        'The line where the call exists. Required except for a proposed new call with highlight added; never invent a source for future code.',
      ),
    tables: z
      .array(z.string().min(1))
      .optional()
      .describe('Tables the call reads or writes, tables[].name on the target node'),
  })
  .describe(
    'A call from one node to another. A response is an edge of its own back to the caller, e.g. "200 OK with the todo".',
  );

const flowStepSchema = z
  .object({
    edgeId: z.string().min(1).describe('An edges[].id'),
    description: z
      .string()
      .min(1)
      .describe(
        'One plain-language sentence in the language the user chose, or the language of their request if none was chosen, about what happens to the user or data. Avoid method names, variable names, request IDs and unexplained acronyms; put those details on nodes and edges. Describe actual behavior, not suggestions or hypothetical failures.',
      ),
  })
  .describe('One step of the playback, in the order the flow actually runs');

/** Vad som sätter igång flödet. Visas där flödet börjar, så det är lätt att följa. */
export const triggerKindSchema = z
  .enum(['user', 'webhook', 'schedule', 'queue', 'request', 'startup', 'system'])
  .describe(
    'user: a person clicks, submits or opens something. webhook: an external system calls in. schedule: a cron job or timer. queue: a message arrives on a queue or topic. request: another service or client calls an API. startup: the application starts. system: anything else inside the system, such as a file change or an internal event.',
  );

const flowTriggerSchema = z
  .object({
    kind: triggerKindSchema,
    label: z
      .string()
      .min(1)
      .max(80)
      .describe(
        'What starts the flow, in plain words, e.g. "User clicks Add" or "Stripe sends payment_succeeded"',
      ),
    nodeId: z.string().min(1).describe('The node where the flow starts, a nodes[].id'),
  })
  .describe(
    brandText(
      'The action that starts the flow. {appName} marks it on the start node so the reader can follow the flow from the beginning.',
    ),
  );

const NODE_KINDS_WITHOUT_SOURCE: ReadonlySet<z.infer<typeof nodeKindSchema>> = new Set([
  'db',
  'cache',
  'external',
  'queue',
]);

export const flowSchema = z
  .object({
    question: z.string().min(1).describe("The user's question the flow answers"),
    title: z.string().min(1).describe('Short, e.g. "Add todo"'),
    summary: z.string().min(1).describe('One or two sentences about what the flow does'),
    trigger: flowTriggerSchema
      .optional()
      .describe(
        'Always include: the action that starts the flow, on the node where the first step begins',
      ),
    systems: z.array(flowSystemSchema).min(1),
    nodes: z.array(flowNodeSchema).min(1),
    edges: z.array(flowEdgeSchema).min(1),
    steps: z.array(flowStepSchema).min(1),
  })
  .superRefine((flow, ctx) => {
    const systemIds = new Set<string>();
    flow.systems.forEach((system, i) => {
      if (systemIds.has(system.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['systems', i, 'id'],
          message: t('validation.duplicateSystem', { id: system.id }),
        });
      }
      systemIds.add(system.id);
    });

    const nodeIds = new Set<string>();
    flow.nodes.forEach((node, i) => {
      if (!systemIds.has(node.system)) {
        ctx.addIssue({
          code: 'custom',
          path: ['nodes', i, 'system'],
          message: t('validation.unknownSystem', { id: node.id, system: node.system }),
        });
      }
      if (nodeIds.has(node.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['nodes', i, 'id'],
          message: t('validation.duplicateNode', { id: node.id }),
        });
      }
      nodeIds.add(node.id);
      if (!node.source && node.highlight !== 'added' && !NODE_KINDS_WITHOUT_SOURCE.has(node.kind)) {
        ctx.addIssue({
          code: 'custom',
          path: ['nodes', i, 'source'],
          message: t('validation.missingSource', { id: node.id, kind: node.kind }),
        });
      }
    });

    const usedSystems = new Set(flow.nodes.map((n) => n.system));
    flow.systems.forEach((system, i) => {
      if (!usedSystems.has(system.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['systems', i],
          message: t('validation.emptySystem', { id: system.id }),
        });
      }
    });

    flow.nodes.forEach((node, i) => {
      const names = new Set(node.tables?.map((t) => t.name));
      node.tables?.forEach((table, ti) => {
        table.columns?.forEach((column, ci) => {
          if (column.references && !names.has(column.references.table)) {
            ctx.addIssue({
              code: 'custom',
              path: ['nodes', i, 'tables', ti, 'columns', ci, 'references'],
              message: t('validation.unknownReference', {
                table: table.name,
                column: column.name,
                target: column.references.table,
              }),
            });
          }
        });
      });
    });

    const tablesByNode = new Map(
      flow.nodes.map((n) => [n.id, new Set(n.tables?.map((t) => t.name))]),
    );
    const edgeIds = new Set<string>();
    flow.edges.forEach((edge, i) => {
      if (!edge.source && edge.highlight !== 'added') {
        ctx.addIssue({
          code: 'custom',
          path: ['edges', i, 'source'],
          message: t('validation.missingEdgeSource', { id: edge.id }),
        });
      }
      for (const table of edge.tables ?? []) {
        if (!tablesByNode.get(edge.to)?.has(table)) {
          ctx.addIssue({
            code: 'custom',
            path: ['edges', i, 'tables'],
            message: t('validation.unknownTable', { id: edge.id, table, node: edge.to }),
          });
        }
      }
      if (edgeIds.has(edge.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['edges', i, 'id'],
          message: t('validation.duplicateEdge', { id: edge.id }),
        });
      }
      edgeIds.add(edge.id);
      for (const end of ['from', 'to'] as const) {
        if (!nodeIds.has(edge[end])) {
          ctx.addIssue({
            code: 'custom',
            path: ['edges', i, end],
            message: t('validation.unknownNode', { id: edge.id, node: edge[end] }),
          });
        }
      }
    });

    if (flow.trigger && !nodeIds.has(flow.trigger.nodeId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['trigger', 'nodeId'],
        message: t('validation.unknownTriggerNode', { node: flow.trigger.nodeId }),
      });
    }

    flow.steps.forEach((step, i) => {
      if (!edgeIds.has(step.edgeId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', i, 'edgeId'],
          message: t('validation.unknownEdge', { step: i + 1, edge: step.edgeId }),
        });
      }
    });
  });

export type NodeKind = z.infer<typeof nodeKindSchema>;
export type SystemKind = z.infer<typeof systemKindSchema>;
export type SourceRef = z.infer<typeof sourceRefSchema>;
export type FlowNode = z.infer<typeof flowNodeSchema>;
export type DataTable = z.infer<typeof dataTableSchema>;
export type FlowEdge = z.infer<typeof flowEdgeSchema>;
export type FlowStep = z.infer<typeof flowStepSchema>;
export type FlowTrigger = z.infer<typeof flowTriggerSchema>;
export type Flow = z.infer<typeof flowSchema>;

export type FlowValidation = { ok: true; flow: Flow } | { ok: false; errors: string[] };

/**
 * Validerar okänd data mot schemat och ger läsbara fel, tänkta att skickas
 * tillbaka till modellen så den kan rätta sig.
 */
export function validateFlow(input: unknown): FlowValidation {
  const result = flowSchema.safeParse(input);
  if (result.success) return { ok: true, flow: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((issue) => {
      const path = issue.path.map(String).join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    }),
  };
}
