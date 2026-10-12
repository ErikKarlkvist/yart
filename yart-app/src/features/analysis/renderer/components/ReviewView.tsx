import { type JSX, useState } from 'react';
import { t } from '@/common/model/i18n';
import {
  findingLocation,
  type ReviewFinding,
  sortFindings,
  worstSeverity,
} from '@/common/model/review';
import { Icon } from '@/common/renderer/Icon';
import { Markdown } from '@/common/renderer/Markdown';
import { ChangesView, type ReviewedFlow } from '@/features/changes';
import { type SavedFlowAnalysis, type SavedReviewAnalysis } from '../../model/analysis';
import { buildReviewFixPlan } from '../../model/plan';
import { AiActions } from './AiActions';
import './document.css';

interface Props {
  analysis: SavedReviewAnalysis;
  flows: readonly SavedFlowAnalysis[];
  onOpenFlow: (id: string) => void;
  /** Öppnar flödet och fokuserar fyndet i grafen och panelen Review */
  onOpenFinding: (flowAnalysisId: string, findingId: string) => void;
  /** Skickar en text till agenten appen kör. Saknas med extern AI. */
  onSendToAgent?: ((text: string) => void) | undefined;
}

/** Fynden i en review grupperade per flöde. Fynd utan flöde hamnar sist. */
interface FindingGroup {
  key: string;
  title: string;
  flow: SavedFlowAnalysis | null;
  findings: ReviewFinding[];
}

type ReviewViewMode = 'review' | 'changes';
const MODES: readonly ReviewViewMode[] = ['review', 'changes'];

/**
 * Reviewdokumentet: kort text om ändringen, flödena den rör och reviewpunkterna.
 * Punkterna man kryssar i blir en fix-plan för AI, att kopiera eller skicka.
 * Växlaren högst upp byter till diffen i flödesordning; det man bockat av där
 * lever så länge reviewn är öppen. Montera om med `key` när reviewn byts så
 * valen börjar om.
 */
export function ReviewView({
  analysis,
  flows,
  onOpenFlow,
  onOpenFinding,
  onSendToAgent,
}: Props): JSX.Element {
  const { review } = analysis;
  const severity = worstSeverity(review.findings);
  const groups = groupFindings(review.flows, review.findings, flows);
  // Det som är fel eller riskabelt är valt från början, info får man välja själv.
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(review.findings.filter((f) => f.severity !== 'info').map((f) => f.id)),
  );
  const chosen = review.findings.filter((f) => selected.has(f.id));
  const toggle = (id: string): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const linked = review.flows.flatMap((name) => flows.filter((f) => f.name === name));
  const [mode, setMode] = useState<ReviewViewMode>('review');
  const [reviewedChunks, setReviewedChunks] = useState<ReadonlySet<string>>(() => new Set());
  const switcher = (
    <span className="document-view__switch" role="group" aria-label={t('review.view')}>
      {MODES.map((option) => (
        <button
          key={option}
          type="button"
          className={`document-view__switch-option${mode === option ? ' is-current' : ''}`}
          aria-pressed={mode === option}
          title={t(option === 'review' ? 'review.viewReviewHint' : 'review.viewChangesHint')}
          onClick={() => {
            setMode(option);
          }}
        >
          {t(option === 'review' ? 'review.viewReview' : 'review.viewChanges')}
        </button>
      ))}
    </span>
  );

  if (mode === 'changes') {
    const reviewedFlows: ReviewedFlow[] = linked.map((f) => ({
      name: f.name,
      title: f.flow.title,
      flow: f.flow,
      base: f.compare?.base,
    }));
    return (
      <ChangesView
        review={review}
        flows={reviewedFlows}
        reviewed={reviewedChunks}
        onToggleReviewed={(id) => {
          setReviewedChunks((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        onOpenFinding={(finding) => {
          const flow = linked.find((f) => f.name === finding.flow);
          if (flow) onOpenFinding(flow.id, finding.id);
        }}
        toolbar={switcher}
      />
    );
  }

  return (
    <article className="document-view">
      <header className="document-view__header">
        <div className="document-view__bar">
          <span className="analyses__tag">{t('analyses.review')}</span>
          {switcher}
        </div>
        <span className="document-view__compare">
          {t('review.compare', { base: review.baseLabel, head: review.headLabel })}
        </span>
        <h2 className="document-view__title">{review.title}</h2>
        <p className="document-view__summary">{review.summary}</p>
        <p className={`document-view__verdict is-${severity ?? 'none'}`}>
          {severity && <Icon name={severity} size="sm" />}{' '}
          {t('review.findings', { count: review.findings.length })}
        </p>
      </header>
      <Markdown text={review.content} className="document-view__content" />

      {review.flows.length > 0 && (
        <section className="document-view__flows">
          <h3>{t('review.flowsHeading')}</h3>
          <ul>
            {review.flows.map((name) => {
              const flow = flows.find((item) => item.name === name);
              return (
                <li key={name}>
                  {flow ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenFlow(flow.id);
                        }}
                      >
                        <span>{flow.flow.title}</span>
                        <span aria-hidden="true">›</span>
                      </button>
                      <p>{flow.flow.summary}</p>
                    </>
                  ) : (
                    <p className="document-view__missing">{t('review.missingFlow', { name })}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {review.findings.length > 0 && (
        <section className="document-view__points">
          <div className="document-view__points-head">
            <h3>{t('review.pointsHeading')}</h3>
            <span className="document-view__points-tools">
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setSelected(new Set(review.findings.map((f) => f.id)));
                }}
              >
                {t('plan.selectAll')}
              </button>
              <button
                type="button"
                className="text-button"
                disabled={chosen.length === 0}
                onClick={() => {
                  setSelected(new Set());
                }}
              >
                {t('plan.clear')}
              </button>
            </span>
          </div>
          {groups.map((group) => (
            <div key={group.key} className="document-view__point-group">
              {group.flow ? (
                <button
                  type="button"
                  className="document-view__point-flow"
                  onClick={() => {
                    if (group.flow) onOpenFlow(group.flow.id);
                  }}
                >
                  {group.title}
                </button>
              ) : (
                <span className="document-view__point-flow">{group.title}</span>
              )}
              <ol className="document-view__findings">
                {group.findings.map((finding) => (
                  <FindingRow
                    key={finding.id}
                    finding={finding}
                    checked={selected.has(finding.id)}
                    onToggle={() => {
                      toggle(finding.id);
                    }}
                    location={findingLocation(finding, group.flow?.flow, group.flow?.compare?.base)}
                    onOpen={
                      group.flow
                        ? () => {
                            if (group.flow) onOpenFinding(group.flow.id, finding.id);
                          }
                        : undefined
                    }
                  />
                ))}
              </ol>
            </div>
          ))}
          <AiActions
            build={() => buildReviewFixPlan(analysis, chosen, linked)}
            copyLabel={t('plan.copyFix', { count: chosen.length })}
            hint={t('plan.fixHint')}
            onSend={onSendToAgent}
            disabled={chosen.length === 0}
          />
        </section>
      )}
    </article>
  );
}

interface FindingRowProps {
  finding: ReviewFinding;
  checked: boolean;
  onToggle: () => void;
  location: string | null;
  onOpen?: (() => void) | undefined;
}

function FindingRow({
  finding,
  checked,
  onToggle,
  location,
  onOpen,
}: FindingRowProps): JSX.Element {
  const head = (
    <>
      <span className={`review__severity is-${finding.severity}`}>
        <Icon name={finding.severity} size="sm" />
      </span>
      <span className="document-view__finding-title">{finding.title}</span>
      {location && <span className="document-view__finding-where">{location}</span>}
    </>
  );
  return (
    <li className={`document-view__finding is-${finding.severity}${checked ? ' is-checked' : ''}`}>
      <div className="document-view__finding-row">
        <input
          type="checkbox"
          checked={checked}
          aria-label={t('plan.include', { title: finding.title })}
          onChange={onToggle}
        />
        {onOpen ? (
          <button
            type="button"
            className="document-view__finding-open"
            title={t('review.openHint')}
            onClick={onOpen}
          >
            {head}
          </button>
        ) : (
          <span className="document-view__finding-open">{head}</span>
        )}
      </div>
      <div className="document-view__finding-body">
        <Markdown text={finding.description} className="document-view__finding-text" />
        {finding.suggestion && (
          <div className="document-view__finding-suggestion">
            <strong>{t('review.suggestion')}</strong>
            <Markdown text={finding.suggestion} className="document-view__finding-text" />
          </div>
        )}
      </div>
    </li>
  );
}

function groupFindings(
  names: readonly string[],
  findings: readonly ReviewFinding[],
  flows: readonly SavedFlowAnalysis[],
): FindingGroup[] {
  const groups: FindingGroup[] = names.map((name) => {
    const flow = flows.find((f) => f.name === name) ?? null;
    return {
      key: name,
      title: flow?.flow.title ?? name,
      flow,
      findings: sortFindings(findings.filter((f) => f.flow === name)),
    };
  });
  const general = sortFindings(findings.filter((f) => f.flow === undefined));
  if (general.length > 0)
    groups.push({ key: '', title: t('review.generalHeading'), flow: null, findings: general });
  return groups.filter((g) => g.findings.length > 0);
}
