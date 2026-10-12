import { type CSSProperties, type JSX, type ReactNode, useMemo } from 'react';
import { t } from '@/common/model/i18n';
import { type Review, type ReviewFinding } from '@/common/model/review';
import { Icon } from '@/common/renderer/Icon';
import { useRepo } from '@/features/repo';
import { type Chunk, type FileDiff, type FileStatus } from '../../model/diff';
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
  /** Chunks användaren bockat av, på chunkens id */
  reviewed: ReadonlySet<string>;
  onToggleReviewed: (chunkId: string) => void;
  /** Öppnar fyndet i dess flöde. Fynd utan flöde kan inte öppnas. */
  onOpenFinding: (finding: ReviewFinding) => void;
  /** Vyväxlaren, som ägs av reviewvyn och visas högst upp */
  toolbar: ReactNode;
}

/**
 * Diffen för en review i flödesordning: en grupp per flöde med chunks som
 * stegen spelas, sedan det inget flöde rör. Avbockade chunks fälls ihop,
 * fynden visas på sin rad i koden.
 */
export function ChangesView({
  review,
  flows,
  reviewed,
  onToggleReviewed,
  onOpenFinding,
  toolbar,
}: Props): JSX.Element {
  const { repo } = useRepo();
  const base = review.baseCommit ?? review.baseLabel;
  const head = review.headCommit ?? review.headLabel;
  const diff = useDiff(repo?.path ?? null, base, head);
  const groups = useMemo(
    () => (diff.status === 'ready' ? groupChunks(diff.files, flows) : []),
    [diff, flows],
  );
  const total = groups.reduce((sum, group) => sum + group.chunks.length, 0);
  const done = groups.reduce(
    (sum, group) => sum + group.chunks.filter((c) => reviewed.has(c.chunk.id)).length,
    0,
  );

  return (
    <div className="changes">
      <header className="changes__head">
        {toolbar}
        <span className="changes__compare">
          {t('review.compare', { base: review.baseLabel, head: review.headLabel })}
        </span>
        {total > 0 && (
          <span className="changes__progress">
            <span
              className="changes__progress-bar"
              style={{ '--progress': `${(done / total) * 100}%` } as CSSProperties}
            />
            {t('changes.progress', { done, total })}
          </span>
        )}
      </header>

      {diff.status === 'loading' && <p className="changes__muted">{t('changes.reading')}</p>}
      {diff.status === 'error' && <p className="changes__error">{diff.message}</p>}
      {diff.status === 'ready' && total === 0 && (
        <p className="changes__muted">
          {t('changes.empty', { base: review.baseLabel, head: review.headLabel })}
        </p>
      )}
      {groups.map((group) => (
        <GroupSection
          key={group.key}
          group={group}
          findings={review.findings}
          reviewed={reviewed}
          onToggleReviewed={onToggleReviewed}
          onOpenFinding={onOpenFinding}
        />
      ))}
    </div>
  );
}

interface GroupProps {
  group: ChangeGroup;
  findings: readonly ReviewFinding[];
  reviewed: ReadonlySet<string>;
  onToggleReviewed: (chunkId: string) => void;
  onOpenFinding: (finding: ReviewFinding) => void;
}

function GroupSection({
  group,
  findings,
  reviewed,
  onToggleReviewed,
  onOpenFinding,
}: GroupProps): JSX.Element {
  const done = group.chunks.filter((c) => reviewed.has(c.chunk.id)).length;
  return (
    <section className="changes__group">
      <header className="changes__group-head">
        <h3 className="changes__group-title">
          {group.flow ? group.flow.title : t('changes.otherHeading')}
        </h3>
        <span className="changes__group-count">
          {t('changes.count', { done, total: group.chunks.length })}
        </span>
      </header>
      <p className="changes__group-summary">
        {group.flow ? group.flow.flow.summary : t('changes.otherHint')}
      </p>
      {group.chunks.length === 0 && <p className="changes__muted">{t('changes.noChunks')}</p>}
      {group.chunks.map((placed) => (
        <ChunkCard
          key={placed.chunk.id}
          placed={placed}
          findings={findings.filter((f) => f.source?.file === placed.chunk.file)}
          reviewed={reviewed.has(placed.chunk.id)}
          onToggle={() => {
            onToggleReviewed(placed.chunk.id);
          }}
          onOpenFinding={onOpenFinding}
        />
      ))}
    </section>
  );
}

interface ChunkProps {
  placed: PlacedChunk;
  /** Fynden i chunkens fil */
  findings: readonly ReviewFinding[];
  reviewed: boolean;
  onToggle: () => void;
  onOpenFinding: (finding: ReviewFinding) => void;
}

function ChunkCard({
  placed,
  findings,
  reviewed,
  onToggle,
  onOpenFinding,
}: ChunkProps): JSX.Element {
  const { chunk, file, place, alsoIn } = placed;
  return (
    <article className={`changes__chunk${reviewed ? ' is-reviewed' : ''}`}>
      <header className="changes__chunk-head">
        <input
          type="checkbox"
          checked={reviewed}
          aria-label={t('changes.markReviewed', { file: chunk.file })}
          onChange={onToggle}
        />
        {place && (
          <span className="changes__place">
            <span className="changes__place-n">{String(place.index).padStart(2, '0')}</span>
            <span className="changes__place-label">{place.label}</span>
          </span>
        )}
        <span className="changes__file">
          {chunk.file}
          <span className="changes__line">:{chunk.newStart}</span>
        </span>
        <FileTag file={file} />
        {chunk.heading && <span className="changes__heading">{chunk.heading}</span>}
        {alsoIn.length > 0 && (
          <span className="changes__also">{t('changes.alsoIn', { flows: alsoIn.join(', ') })}</span>
        )}
      </header>
      {!reviewed && (
        <ChunkCode
          chunk={chunk}
          binary={file.binary}
          findings={findings}
          onOpenFinding={onOpenFinding}
        />
      )}
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
  binary: boolean;
  findings: readonly ReviewFinding[];
  onOpenFinding: (finding: ReviewFinding) => void;
}

function ChunkCode({ chunk, binary, findings, onOpenFinding }: CodeProps): JSX.Element {
  if (binary) return <p className="changes__muted">{t('changes.binary')}</p>;
  return (
    <pre className="changes__code">
      {chunk.lines.map((line, i) => {
        const here =
          line.newNumber === undefined
            ? []
            : findings.filter((f) => f.source?.line === line.newNumber);
        return (
          <div key={i} className="changes__row">
            <div className={`changes__line-row is-${line.kind}`}>
              <span className="changes__n">{line.oldNumber ?? ''}</span>
              <span className="changes__n">{line.newNumber ?? ''}</span>
              <span className="changes__text">{line.text || ' '}</span>
            </div>
            {here.map((finding) => (
              <button
                key={finding.id}
                type="button"
                className={`changes__finding is-${finding.severity}`}
                disabled={finding.flow === undefined}
                title={t('review.openHint')}
                onClick={() => {
                  onOpenFinding(finding);
                }}
              >
                <Icon name={finding.severity} size="sm" />
                <span className="changes__finding-body">
                  <span className="changes__finding-title">{finding.title}</span>
                  <span className="changes__finding-text">{finding.description}</span>
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </pre>
  );
}
