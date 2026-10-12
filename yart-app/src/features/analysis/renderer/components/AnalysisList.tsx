import { type DragEvent, type JSX, type MouseEvent, useCallback, useRef, useState } from 'react';
import { LOCALE, t } from '@/common/model/i18n';
import { worstSeverity } from '@/common/model/review';
import { allSteps } from '@/common/model/steps';
import { ContextMenu, type ContextMenuItem } from '@/common/renderer/ContextMenu';
import { Icon } from '@/common/renderer/Icon';
import { readStoredJson, writeStored } from '@/common/renderer/storage';
import { analysisTitle, findingsForFlow, refLabel, type SavedAnalysis } from '../../model/analysis';
import {
  applyLayout,
  EMPTY_LAYOUT,
  isListLayout,
  type ListLayout,
  moveGroup,
  moveItem,
  renameGroup,
} from '../../model/listLayout';
import { useAnalyses } from '../AnalysisContext';
import './analysis.css';

interface Props {
  /** Repot listan gäller; ordningen och rubrikerna användaren satt sparas per repo */
  repoPath: string;
  /** Namnet på konversationen i appen som sparade analyser, null om den inte finns */
  conversationTitle?: (conversationId: string) => string | null;
}

const ITEM_DRAG_TYPE = 'application/x-yart-analysis';
const GROUP_DRAG_TYPE = 'application/x-yart-analysis-group';

type Dragging = { type: 'item'; id: string; home: string } | { type: 'group'; key: string };
/** Luckan som markeras medan något dras över listan */
type Drop = { type: 'item'; group: string; index: number } | { type: 'group'; index: number };
type Target = { type: 'item'; analysis: SavedAnalysis } | { type: 'group'; group: Group };
interface Menu {
  x: number;
  y: number;
  target: Target;
}
type Editing = { type: 'item'; id: string } | { type: 'group'; key: string };

/**
 * Analyserna i repot, grupperade. Användaren drar analyser och grupper till
 * den ordning som passar, flyttar analyser mellan grupper och döper om
 * båda via högerklick. Ordningen sparas per repo i localStorage; en ny
 * titel sparas i analysen.
 */
export function AnalysisList({ repoPath, conversationTitle }: Props): JSX.Element {
  const { analyses, current, error, rejection, select, remove, rename, dismissRejection } =
    useAnalyses();
  const [layout, setLayout] = useListLayout(repoPath);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [menu, setMenu] = useState<Menu | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const dragging = useRef<Dragging | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);

  const derived = groupAnalyses(analyses, conversationTitle);
  const home = new Map(derived.flatMap((g) => g.items.map((a) => [a.id, g.key] as const)));
  const groups = applyLayout(layout, {
    groups: derived,
    itemsOf: (g) => g.items,
    withItems: (g, items, label) => ({ ...g, items, label }),
  });

  const toggle = (key: string): void => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const endDrag = (): void => {
    dragging.current = null;
    setDrop(null);
  };
  const dropAt = (event: DragEvent, place: Drop): void => {
    const active = dragging.current;
    if (active?.type !== place.type) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDrop(place);
  };
  const finishDrop = (event: DragEvent): void => {
    const active = dragging.current;
    if (!drop || active?.type !== drop.type) return;
    event.preventDefault();
    if (active.type === 'item' && drop.type === 'item') {
      const visible = groups.find((g) => g.key === drop.group)?.items.map((a) => a.id) ?? [];
      setLayout(moveItem(layout, active.id, active.home, drop.group, visible, drop.index));
    } else if (active.type === 'group' && drop.type === 'group') {
      setLayout(
        moveGroup(
          layout,
          groups.map((g) => g.key),
          active.key,
          drop.index,
        ),
      );
    }
    endDrag();
  };

  const menuItems = (target: Target): ContextMenuItem[] =>
    target.type === 'group'
      ? [
          {
            label: t('analyses.renameGroup'),
            onSelect: () => {
              setEditing({ type: 'group', key: target.group.key });
            },
          },
        ]
      : [
          {
            label: t('analyses.rename'),
            disabled: target.analysis.origin === 'builtin',
            onSelect: () => {
              setEditing({ type: 'item', id: target.analysis.id });
            },
          },
          {
            label: t('analyses.delete'),
            disabled: target.analysis.origin === 'builtin',
            onSelect: () => void remove(target.analysis.id),
          },
        ];

  return (
    <section className="analyses" onDrop={finishDrop} onDragEnd={endDrag}>
      {error && <p className="analyses__error">{error}</p>}
      {rejection?.type === 'rejected' && (
        <div className="analyses__error analyses__rejection">
          <div className="analyses__rejection-head">
            <span>{t('log.rejected', { source: rejection.source })}</span>
            <button
              type="button"
              className="icon-button icon-button--quiet"
              title={t('log.dismiss')}
              aria-label={t('log.dismiss')}
              onClick={dismissRejection}
            >
              <Icon name="close" size="sm" />
            </button>
          </div>
          <ul className="analyses__rejection-errors">
            {rejection.errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          <p className="analyses__rejection-hint">{t('log.errorsReturned')}</p>
        </div>
      )}
      {analyses.length === 0 && !error && <p className="analyses__muted">{t('analyses.empty')}</p>}
      {groups.map((group, groupIndex) => {
        const open = !collapsed.has(group.key);
        const groupDrop =
          drop?.type === 'group' &&
          (drop.index === groupIndex
            ? 'before'
            : drop.index === groups.length && groupIndex === groups.length - 1
              ? 'after'
              : null);
        return (
          <div
            key={group.key}
            className={`analyses__group${groupDrop ? ` is-drop-${groupDrop}` : ''}`}
          >
            <h3
              className="analyses__group-heading"
              draggable={editing?.type !== 'group' || editing.key !== group.key}
              onDragStart={(event) => {
                dragging.current = { type: 'group', key: group.key };
                event.dataTransfer.setData(GROUP_DRAG_TYPE, group.key);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => {
                if (dragging.current?.type === 'item') {
                  dropAt(event, { type: 'item', group: group.key, index: group.items.length });
                } else {
                  dropAt(event, { type: 'group', index: groupIndex + half(event) });
                }
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu({ x: event.clientX, y: event.clientY, target: { type: 'group', group } });
              }}
            >
              {editing?.type === 'group' && editing.key === group.key ? (
                <RenameField
                  value={group.label}
                  onCommit={(label) => {
                    setLayout(renameGroup(layout, group.key, label));
                    setEditing(null);
                  }}
                  onCancel={() => {
                    setEditing(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="analyses__group-toggle"
                  aria-expanded={open}
                  title={`${group.title} — ${t('analyses.groupReorder')}`}
                  onClick={() => {
                    toggle(group.key);
                  }}
                >
                  <Icon name={open ? 'chevronDown' : 'chevronRight'} size="sm" />
                  <span
                    className={`analyses__group-label${group.isRef ? ' analyses__group-label--ref' : ''}`}
                  >
                    {group.label}
                  </span>
                  <span className="count-badge">{group.items.length}</span>
                </button>
              )}
            </h3>
            {open && (
              <ul
                className={`analyses__list${drop?.type === 'item' && drop.group === group.key && drop.index === group.items.length ? ' is-drop-after' : ''}`}
              >
                {group.items.map((analysis, index) => (
                  <AnalysisRow
                    key={analysis.id}
                    analysis={analysis}
                    analyses={analyses}
                    active={analysis.id === current?.id}
                    dropBefore={
                      drop?.type === 'item' && drop.group === group.key && drop.index === index
                    }
                    editing={editing?.type === 'item' && editing.id === analysis.id}
                    onSelect={() => {
                      select(analysis.id === current?.id ? null : analysis.id);
                    }}
                    onRename={(title) => {
                      setEditing(null);
                      void rename(analysis.id, title);
                    }}
                    onCancelRename={() => {
                      setEditing(null);
                    }}
                    onRemove={() => void remove(analysis.id)}
                    onDragStart={(event) => {
                      dragging.current = {
                        type: 'item',
                        id: analysis.id,
                        home: home.get(analysis.id) ?? group.key,
                      };
                      event.dataTransfer.setData(ITEM_DRAG_TYPE, analysis.id);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(event) => {
                      dropAt(event, { type: 'item', group: group.key, index: index + half(event) });
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setMenu({
                        x: event.clientX,
                        y: event.clientY,
                        target: { type: 'item', analysis },
                      });
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.target)}
          onDismiss={() => {
            setMenu(null);
          }}
        />
      )}
    </section>
  );
}

/** 0 om pekaren är i övre halvan av elementet, annars 1: luckan före eller efter. */
function half(event: DragEvent): number {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? 0 : 1;
}

interface RowProps {
  analysis: SavedAnalysis;
  analyses: readonly SavedAnalysis[];
  active: boolean;
  dropBefore: boolean;
  editing: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onCancelRename: () => void;
  onRemove: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragOver: (event: DragEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
}

function AnalysisRow({
  analysis,
  analyses,
  active,
  dropBefore,
  editing,
  onSelect,
  onRename,
  onCancelRename,
  onRemove,
  onDragStart,
  onDragOver,
  onContextMenu,
}: RowProps): JSX.Element {
  const title = analysisTitle(analysis);
  const compare =
    analysis.kind === 'review'
      ? analysis.review
      : analysis.kind === 'flow'
        ? analysis.compare
        : undefined;
  const description =
    analysis.kind === 'document'
      ? analysis.document.summary
      : compare
        ? t('review.compare', { base: compare.baseLabel, head: compare.headLabel })
        : analysis.origin === 'builtin'
          ? t('analyses.builtin')
          : formatDate(analysis.createdAt);
  const flowFindings = analysis.kind === 'flow' ? findingsForFlow(analyses, analysis.name) : [];
  const flowSeverity = worstSeverity(flowFindings);
  const meta =
    analysis.kind === 'flow'
      ? t('analyses.steps', { count: allSteps(analysis.flow.steps).length })
      : analysis.kind === 'document'
        ? t('analyses.linkedFlows', { count: analysis.document.flows.length })
        : t('analyses.findings', { count: analysis.review.findings.length });
  return (
    <li
      className={`analyses__item${active ? ' is-active' : ''}${dropBefore ? ' is-drop-before' : ''}`}
      draggable={!editing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onContextMenu={onContextMenu}
    >
      {editing ? (
        <div className="analyses__open">
          <RenameField value={title} onCommit={onRename} onCancel={onCancelRename} />
        </div>
      ) : (
        <button
          type="button"
          className="analyses__open"
          title={`${analysis.kind === 'flow' ? analysis.flow.question : analysisSummary(analysis)} — ${t('analyses.reorder')}`}
          onClick={onSelect}
        >
          <span className="analyses__title">
            {analysis.kind === 'review' ? (
              <span
                className={`analyses__tag is-${worstSeverity(analysis.review.findings) ?? 'none'}`}
              >
                {t('analyses.review')}
              </span>
            ) : (
              <span className={`analyses__tag is-${analysis.kind}`}>
                {t(analysis.kind === 'document' ? 'analyses.document' : 'analyses.flow')}
              </span>
            )}
            <span className="analyses__title-text">{title}</span>
          </span>
          <span className="analyses__meta">
            {description} · {meta}
          </span>
        </button>
      )}
      {flowSeverity && (
        <span
          className={`analyses__findings is-${flowSeverity}`}
          title={t('review.findings', { count: flowFindings.length })}
        >
          {t(`review.count.${flowSeverity}`, { count: flowFindings.length })}
        </span>
      )}
      {analysis.origin !== 'builtin' && (
        <button
          type="button"
          className="icon-button icon-button--quiet"
          title={t('analyses.delete')}
          aria-label={t('analyses.delete')}
          onClick={onRemove}
        >
          <Icon name="close" size="sm" />
        </button>
      )}
    </li>
  );
}

interface RenameProps {
  value: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

/** Fältet som ersätter en titel medan den döps om: Enter sparar, Escape ångrar, tom text ångrar. */
function RenameField({ value, onCommit, onCancel }: RenameProps): JSX.Element {
  const [draft, setDraft] = useState(value);
  const commit = (): void => {
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else onCancel();
  };
  return (
    <input
      className="analyses__rename"
      aria-label={t('analyses.renameTitle')}
      value={draft}
      autoFocus
      onFocus={(event) => {
        event.target.select();
      }}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        else if (event.key === 'Escape') onCancel();
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
    />
  );
}

/** Ordningen och rubrikerna användaren satt, per repo. */
function useListLayout(repoPath: string): [ListLayout, (next: ListLayout) => void] {
  const key = `yart.analysesLayout:${repoPath}`;
  const [stored, setStored] = useState<{ key: string; layout: ListLayout } | null>(null);
  const layout =
    stored?.key === key ? stored.layout : (readStoredJson(key, isListLayout) ?? EMPTY_LAYOUT);
  const set = useCallback(
    (next: ListLayout) => {
      setStored({ key, layout: next });
      writeStored(key, JSON.stringify(next));
    },
    [key],
  );
  return [layout, set];
}

interface Group {
  key: string;
  label: string;
  /** Rubriken är branch och commit, inte ett namn */
  isRef: boolean;
  title: string;
  items: SavedAnalysis[];
}

/**
 * Grupperar på konversationen som skapade analyserna, med dess namn som
 * rubrik, så det man bad om hålls ihop. Analyser utan konversation, från
 * externa agenter, grupperas på branch och commit eftersom ett flöde bara
 * gäller en version av koden. Inbyggda först, sedan grupperna i ordning
 * efter nyaste analys, sist sådant utan git.
 */
function groupAnalyses(
  analyses: readonly SavedAnalysis[],
  conversationTitle: Props['conversationTitle'],
): Group[] {
  const groups = new Map<string, Group>();
  for (const analysis of analyses) {
    const conversation =
      analysis.conversationId !== undefined
        ? (conversationTitle?.(analysis.conversationId) ?? null)
        : null;
    const key =
      analysis.origin === 'builtin'
        ? 'builtin'
        : conversation !== null
          ? `conversation:${analysis.conversationId ?? ''}`
          : (analysis.ref?.commit ?? 'worktree');
    const ref = analysis.ref ? refLabel(analysis.ref) : t('analyses.workingTree');
    const group = groups.get(key) ?? {
      key,
      label: analysis.origin === 'builtin' ? t('analyses.builtin') : (conversation ?? ref),
      isRef: analysis.origin !== 'builtin' && conversation === null,
      title: conversation !== null ? ref : (analysis.ref?.commit ?? ''),
      items: [],
    };
    group.items.push(analysis);
    groups.set(key, group);
  }
  const order = (g: Group): number => (g.key === 'builtin' ? 0 : g.key === 'worktree' ? 2 : 1);
  return [...groups.values()].sort((a, b) => order(a) - order(b));
}

function analysisSummary(analysis: SavedAnalysis): string {
  switch (analysis.kind) {
    case 'flow':
      return analysis.flow.summary;
    case 'document':
      return analysis.document.summary;
    case 'review':
      return analysis.review.summary;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' });
}
