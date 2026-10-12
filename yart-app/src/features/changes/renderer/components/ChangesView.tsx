import { type CSSProperties, type JSX, useMemo, useState } from 'react';
import { t } from '@/common/model/i18n';
import { type Review, type ReviewFinding } from '@/common/model/review';
import { Icon } from '@/common/renderer/Icon';
import { useStoredChoice } from '@/common/renderer/useStored';
import { useRepo } from '@/features/repo';
import { type Chunk, type FileDiff, type FileStatus, splitRows } from '../../model/diff';
import {
  type ChangeGroup,
  groupChunks,
  type PlacedChunk,
  type ReviewedFlow,
} from '../../model/group';
import { useDiff } from '../hooks/useDiff';
import './changes.css';

interface Props {
  review: Review;
  /** Reviewns flöden som finns sparade, i reviewns ordning */
  flows: readonly ReviewedFlow[];
  /** Öppnar fyndet i dess flöde. Fynd utan flöde kan inte öppnas. */
  onOpenFinding: (finding: ReviewFinding) => void;
}

type DiffLayout = 'inline' | 'split';
const LAYOUTS: readonly DiffLayout[] = ['inline', 'split'];

/** En chunk med gruppen den visas i, i den ordning genomgången går. */
interface Stop {
  group: ChangeGroup;
  placed: PlacedChunk;
}

/**
 * Diffen för en review som en genomgång: en chunk i taget i flödesordning,
 * med stegets beskrivning som förklaring och fynden på sina rader. Next
 * bockar av chunken och går vidare; översikten till vänster hoppar fritt.
 * Det avbockade lever så länge vyn är monterad; montera om med `key` när
 * reviewn byts.
 */
export function ChangesView({ review, flows, onOpenFinding }: Props): JSX.Element {
  const { repo } = useRepo();
  const base = review.baseCommit ?? review.baseLabel;
  const head = review.headCommit ?? review.headLabel;
  const diff = useDiff(repo?.path ?? null, base, head);
  const stops = useMemo<Stop[]>(
    () =>
      diff.status === 'ready'
        ? groupChunks(diff.files, flows).flatMap((group) =>
            group.chunks.map((placed) => ({ group, placed })),
          )
        : [],
    [diff, flows],
  );
  const [reviewed, setReviewed] = useState<ReadonlySet<string>>(() => new Set());
  const [position, setPosition] = useState(0);
  const [layout, setLayout] = useStoredChoice<DiffLayout>('yart.diffLayout', LAYOUTS, 'inline');
  const index = Math.min(position, Math.max(stops.length - 1, 0));
  const current = stops[index] ?? null;
  const done = stops.filter((s) => reviewed.has(s.placed.chunk.id)).length;

  const next = (): void => {
    if (!current) return;
    setReviewed((set) => new Set(set).add(current.placed.chunk.id));
    if (index < stops.length - 1) setPosition(index + 1);
  };

  return (
    <div className="changes">
      <header className="changes__head">
        <h2 className="changes__title">{t('changes.title', { title: review.title })}</h2>
        <span className="changes__compare">
          {t('review.compare', { base: review.baseLabel, head: review.headLabel })}
        </span>
        <span className="changes__layouts" role="group" aria-label={t('changes.layout')}>
          {LAYOUTS.map((option) => (
            <button
              key={option}
              type="button"
              className={`changes__layout${layout === option ? ' is-current' : ''}`}
              aria-pressed={layout === option}
              onClick={() => {
                setLayout(option);
              }}
            >
              {t(option === 'inline' ? 'changes.layoutInline' : 'changes.layoutSplit')}
            </button>
          ))}
        </span>
        {stops.length > 0 && (
          <span
            className="changes__progress"
            title={t('changes.progress', { done, total: stops.length })}
          >
            <span
              className="changes__progress-bar"
              style={{ '--progress': `${(done / stops.length) * 100}%` } as CSSProperties}
            />
            {t('changes.position', { index: index + 1, total: stops.length })}
          </span>
        )}
        {current && (
          <nav className="changes__nav">
            {done === stops.length && (
              <span className="changes__all-done">{t('changes.allReviewed')}</span>
            )}
            <button
              type="button"
              className="button"
              disabled={index === 0}
              onClick={() => {
                setPosition(index - 1);
              }}
            >
              {t('changes.previous')}
            </button>
            <button
              type="button"
              className="button button--primary"
              title={t('changes.nextHint')}
              onClick={next}
            >
              {t(index === stops.length - 1 ? 'changes.finish' : 'changes.next')}
            </button>
          </nav>
        )}
      </header>

      {diff.status === 'loading' && (
        <p className="changes__muted changes__notice">{t('changes.reading')}</p>
      )}
      {diff.status === 'error' && <p className="changes__error changes__notice">{diff.message}</p>}
      {diff.status === 'ready' && stops.length === 0 && (
        <p className="changes__muted changes__notice">
          {t('changes.empty', { base: review.baseLabel, head: review.headLabel })}
        </p>
      )}
      {current && (
        <div className="changes__body">
          <Outline stops={stops} index={index} reviewed={reviewed} onJump={setPosition} />
          <StopView
            key={current.placed.chunk.id}
            stop={current}
            layout={layout}
            findings={review.findings.filter((f) => f.source?.file === current.placed.chunk.file)}
            onOpenFinding={onOpenFinding}
          />
        </div>
      )}
    </div>
  );
}

interface OutlineProps {
  stops: readonly Stop[];
  index: number;
  reviewed: ReadonlySet<string>;
  onJump: (index: number) => void;
}

/** Alla chunks i genomgångens ordning, grupperade på flöde, med den aktuella markerad. */
function Outline({ stops, index, reviewed, onJump }: OutlineProps): JSX.Element {
  return (
    <nav className="changes__outline" aria-label={t('changes.outline')}>
      {stops.map((stop, i) => {
        const first = i === 0 || stops[i - 1]?.group !== stop.group;
        const { chunk, place } = stop.placed;
        return (
          <div key={chunk.id}>
            {first && (
              <h3 className="changes__outline-group">
                {stop.group.flow ? stop.group.flow.title : t('changes.otherHeading')}
              </h3>
            )}
            <button
              type="button"
              className={`changes__outline-item${i === index ? ' is-current' : ''}${reviewed.has(chunk.id) ? ' is-reviewed' : ''}`}
              aria-current={i === index}
              title={chunk.file}
              onClick={() => {
                onJump(i);
              }}
            >
              <span className="changes__outline-n">
                {place ? String(place.index).padStart(2, '0') : '··'}
              </span>
              <span className="changes__outline-file">{baseName(chunk.file)}</span>
              {reviewed.has(chunk.id) && <Icon name="check" size="sm" />}
            </button>
          </div>
        );
      })}
    </nav>
  );
}

function baseName(file: string): string {
  return file.slice(file.lastIndexOf('/') + 1);
}

interface StopProps {
  stop: Stop;
  layout: DiffLayout;
  /** Fynden i chunkens fil */
  findings: readonly ReviewFinding[];
  onOpenFinding: (finding: ReviewFinding) => void;
}

/** Den aktuella chunken: var i flödet, förklaringen, filen och koden. */
function StopView({ stop, layout, findings, onOpenFinding }: StopProps): JSX.Element {
  const { chunk, file, place, alsoIn } = stop.placed;
  const flow = stop.group.flow;
  return (
    <article className="changes__stop">
      <header className="changes__stop-head">
        <span className="changes__stop-flow">
          {flow ? flow.title : t('changes.otherHeading')}
          {place && (
            <>
              {' · '}
              {place.index === 0 ? t('changes.start') : t('changes.step', { index: place.index })}
            </>
          )}
        </span>
        {place && <h3 className="changes__stop-title">{place.label}</h3>}
        <p className="changes__stop-explanation">
          {place?.description ?? (flow ? flow.flow.summary : t('changes.noExplanation'))}
        </p>
        {alsoIn.length > 0 && (
          <p className="changes__also">{t('changes.alsoIn', { flows: alsoIn.join(', ') })}</p>
        )}
      </header>
      <div className="changes__chunk">
        <div className="changes__chunk-head">
          <span className="changes__file">
            {chunk.file}
            <span className="changes__line">:{chunk.newStart}</span>
          </span>
          <FileTag file={file} />
          {chunk.heading && <span className="changes__heading">{chunk.heading}</span>}
        </div>
        {file.binary ? (
          <p className="changes__muted">{t('changes.binary')}</p>
        ) : layout === 'split' ? (
          <SplitCode chunk={chunk} findings={findings} onOpenFinding={onOpenFinding} />
        ) : (
          <InlineCode chunk={chunk} findings={findings} onOpenFinding={onOpenFinding} />
        )}
      </div>
    </article>
  );
}

const STATUS_TEXT = {
  added: 'changes.status.added',
  deleted: 'changes.status.deleted',
  renamed: 'changes.status.renamed',
} as const satisfies Record<Exclude<FileStatus, 'modified'>, string>;

function FileTag({ file }: { file: FileDiff }): JSX.Element | null {
  if (file.status === 'modified') return null;
  return (
    <span className={`changes__tag is-${file.status}`}>
      {t(STATUS_TEXT[file.status])}
      {file.oldFile && ` ${t('changes.renamedFrom', { file: file.oldFile })}`}
    </span>
  );
}

interface CodeProps {
  chunk: Chunk;
  findings: readonly ReviewFinding[];
  onOpenFinding: (finding: ReviewFinding) => void;
}

function InlineCode({ chunk, findings, onOpenFinding }: CodeProps): JSX.Element {
  return (
    <pre className="changes__code">
      {chunk.lines.map((line, i) => (
        <div key={i} className="changes__row">
          <div className={`changes__line-row is-${line.kind}`}>
            <span className="changes__n">{line.oldNumber ?? ''}</span>
            <span className="changes__n">{line.newNumber ?? ''}</span>
            <span className="changes__text">{line.text || ' '}</span>
          </div>
          <Findings line={line.newNumber} findings={findings} onOpenFinding={onOpenFinding} />
        </div>
      ))}
    </pre>
  );
}

function SplitCode({ chunk, findings, onOpenFinding }: CodeProps): JSX.Element {
  return (
    <pre className="changes__code changes__code--split">
      <div className="changes__split-heads">
        <span>{t('changes.base')}</span>
        <span>{t('changes.head')}</span>
      </div>
      {splitRows(chunk).map((row, i) => (
        <div key={i} className="changes__row">
          <div className="changes__split-row">
            <div className={`changes__line-row is-${row.old?.kind ?? 'empty'}`}>
              <span className="changes__n">{row.old?.oldNumber ?? ''}</span>
              <span className="changes__text">{row.old ? row.old.text || ' ' : ' '}</span>
            </div>
            <div className={`changes__line-row is-${row.new?.kind ?? 'empty'}`}>
              <span className="changes__n">{row.new?.newNumber ?? ''}</span>
              <span className="changes__text">{row.new ? row.new.text || ' ' : ' '}</span>
            </div>
          </div>
          <Findings line={row.new?.newNumber} findings={findings} onOpenFinding={onOpenFinding} />
        </div>
      ))}
    </pre>
  );
}

interface FindingsProps {
  /** Radnumret i head, undefined på borttagna rader */
  line: number | undefined;
  findings: readonly ReviewFinding[];
  onOpenFinding: (finding: ReviewFinding) => void;
}

/**
 * Fynden som pekar på raden, under den i allvarsgradens färg. Ihopfällda
 * till ikon och titel så koden går att läsa; klick visar beskrivningen.
 */
function Findings({ line, findings, onOpenFinding }: FindingsProps): JSX.Element | null {
  const here = line === undefined ? [] : findings.filter((f) => f.source?.line === line);
  if (here.length === 0) return null;
  return (
    <>
      {here.map((finding) => (
        <FindingRow key={finding.id} finding={finding} onOpen={onOpenFinding} />
      ))}
    </>
  );
}

function FindingRow({
  finding,
  onOpen,
}: {
  finding: ReviewFinding;
  onOpen: (finding: ReviewFinding) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className={`changes__finding is-${finding.severity}${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="changes__finding-toggle"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <Icon name={finding.severity} size="sm" />
        <span className="changes__finding-title">{finding.title}</span>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size="sm" />
      </button>
      {open && (
        <div className="changes__finding-body">
          <span className="changes__finding-text">{finding.description}</span>
          {finding.flow !== undefined && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                onOpen(finding);
              }}
            >
              {t('review.openHint')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
