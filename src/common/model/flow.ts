import { z } from 'zod';
import { t } from './i18n';

/**
 * Kontraktet mellan analysen (AI:n) och visualiseringen. AI:n producerar ett
 * Flow, UI:t ritar och spelar upp det. Allt som ritas ska gå att spåra
 * tillbaka till en fil och rad i repot.
 */

export const nodeKindSchema = z.enum([
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
]);

/** Vilken sorts system en grupp noder tillhör. Visas i systemvyn. */
export const systemKindSchema = z.enum([
  /** Klientapplikation: webb, mobil, desktop */
  'app',
  /** Backend eller API-tjänst */
  'api',
  'db',
  'cache',
  'external',
  'queue',
]);

const flowSystemSchema = z.object({
  id: z.string().min(1),
  kind: systemKindSchema,
  label: z.string().min(1),
  description: z.string().optional(),
});

export const sourceRefSchema = z.object({
  /** Sökväg relativt repots rot */
  file: z.string().min(1),
  line: z.number().int().positive(),
  endLine: z.number().int().positive().optional(),
});

const columnReferenceSchema = z.object({
  /** Tabell i samma nod */
  table: z.string().min(1),
  column: z.string().min(1),
});

const tableColumnSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string().optional(),
  primaryKey: z.boolean().optional(),
  /** Främmande nyckel: kolumnen pekar på en annan tabell i samma nod */
  references: columnReferenceSchema.optional(),
});

/** En tabell, collection eller nyckelrymd i en lagringsnod. */
const dataTableSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  columns: z.array(tableColumnSchema).optional(),
  /** Var schemat definieras, t.ex. en migration eller schema.sql */
  source: sourceRefSchema.optional(),
});

const flowNodeSchema = z.object({
  id: z.string().min(1),
  kind: nodeKindSchema,
  /** Systemet noden tillhör, refererar `systems[].id` */
  system: z.string().min(1),
  label: z.string().min(1),
  /** A short, specific type label such as Hook, Action or Event. */
  role: z.string().min(1).optional(),
  description: z.string().optional(),
  /** Krävs för allt som finns i repot. Valfritt för db, cache, external och queue. */
  source: sourceRefSchema.optional(),
  /** Tabeller eller nycklar som noden lagrar. Främst för db och cache. */
  tables: z.array(dataTableSchema).optional(),
});

const flowEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  /** Kort, t.ex. "POST /api/cart/items" eller "INSERT cart_items" */
  label: z.string().min(1),
  /** Vad som skickas. Fritext eller exempel-JSON. */
  payload: z.string().optional(),
  /** Vad som kommer tillbaka, om något. */
  response: z.string().optional(),
  /** Raden där anropet görs. */
  source: sourceRefSchema,
  /** Tabeller som anropet rör, refererar `tables[].name` på målnoden. */
  tables: z.array(z.string().min(1)).optional(),
});

const flowStepSchema = z.object({
  edgeId: z.string().min(1),
  /** En mening om vad som händer i det här steget. */
  description: z.string().min(1),
});

const NODE_KINDS_WITHOUT_SOURCE: ReadonlySet<z.infer<typeof nodeKindSchema>> = new Set([
  'db',
  'cache',
  'external',
  'queue',
]);

export const flowSchema = z
  .object({
    /** Frågan som ställdes */
    question: z.string().min(1),
    title: z.string().min(1),
    /** En mening om vad flödet gör */
    summary: z.string().min(1),
    /** Applikationerna och systemen som deltar. Systemvyn visar flödet mellan dem. */
    systems: z.array(flowSystemSchema).min(1),
    nodes: z.array(flowNodeSchema).min(1),
    edges: z.array(flowEdgeSchema).min(1),
    /** Ordningen flödet spelas upp i */
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
      if (!node.source && !NODE_KINDS_WITHOUT_SOURCE.has(node.kind)) {
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
