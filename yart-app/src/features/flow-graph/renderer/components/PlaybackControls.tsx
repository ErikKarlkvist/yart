import { type JSX } from 'react';
import { type FlowStep } from '@/common/model/flow';
import { t } from '@/common/model/i18n';
import { type PlayedAlt } from '@/common/model/steps';
import { Icon } from '@/common/renderer/Icon';
import { type Playback } from '../hooks/useFlowPlayback';
import { type FlowHighlight } from '../../model/highlight';

interface Props {
  steps: readonly FlowStep[];
  playback: Playback;
  highlights: ReadonlyMap<string, FlowHighlight>;
  /** Alternativen uppspelningen passerar, med en knapp per gren */
  alts: readonly PlayedAlt[];
  onChooseBranch: (key: string, branch: number) => void;
}

/** Två siffror, så räknaren inte hoppar: 03/10 */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function PlaybackControls({
  steps,
  playback,
  highlights,
  alts,
  onChooseBranch,
}: Props): JSX.Element {
  const step = steps[playback.stepIndex];
  const highlight = step ? highlights.get(step.edgeId) : undefined;
  const total = steps.length;

  return (
    <div className="playback">
      <div className="playback__bar">
        <div className="playback__buttons">
          <button
            type="button"
            className="playback__button"
            onClick={playback.restart}
            title={t('playback.restart')}
            aria-label={t('playback.restart')}
            disabled={total === 0}
          >
            <Icon name="restart" size="sm" />
          </button>
          <button
            type="button"
            className="playback__button playback__button--divided"
            onClick={playback.prev}
            title={t('playback.previous')}
            aria-label={t('playback.previous')}
            disabled={playback.stepIndex <= 0}
          >
            <Icon name="stepBack" size="sm" />
          </button>
          <button
            type="button"
            className="playback__button playback__play"
            onClick={playback.toggle}
            title={playback.playing ? t('playback.pause') : t('playback.play')}
            aria-label={playback.playing ? t('playback.pause') : t('playback.play')}
            disabled={total === 0}
          >
            <Icon name={playback.playing ? 'pause' : 'play'} size="sm" />
          </button>
          <button
            type="button"
            className="playback__button"
            onClick={playback.next}
            title={t('playback.next')}
            aria-label={t('playback.next')}
            disabled={playback.atEnd}
          >
            <Icon name="stepForward" size="sm" />
          </button>
        </div>
        {/* Ett segment per steg; klick hoppar dit. Spelade steg lyser. */}
        <div
          className="playback__segments"
          role="group"
          aria-label={t('playback.step')}
          style={{ gridTemplateColumns: `repeat(${Math.max(1, total)}, 1fr)` }}
        >
          {steps.map((s, i) => (
            <button
              key={i}
              type="button"
              className={`playback__segment${i <= playback.stepIndex ? ' is-played' : ''}`}
              title={s.description}
              aria-label={t('graph.goToStep', { step: i + 1 })}
              aria-current={i === playback.stepIndex ? 'step' : undefined}
              onClick={() => {
                playback.goTo(i);
              }}
            />
          ))}
        </div>
        <span className="playback__counter">
          {pad(playback.stepIndex + 1)}/{pad(total)}
        </span>
      </div>
      {alts.length > 0 && (
        <div className="playback__alts" role="group" aria-label={t('playback.paths')}>
          {alts.map(({ key, alt, selected }) => (
            <span key={key} className="playback__alt">
              <span className="playback__alt-label">{alt.alt}</span>
              <span className="playback__alt-branches">
                {alt.branches.map((branch, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`playback__alt-branch${index === selected ? ' is-selected' : ''}`}
                    aria-pressed={index === selected}
                    title={t('sequence.chooseBranch', { label: branch.label })}
                    onClick={() => {
                      onChooseBranch(key, index);
                    }}
                  >
                    {branch.label}
                  </button>
                ))}
              </span>
            </span>
          ))}
        </div>
      )}
      <div className={`playback__text${highlight ? ` is-highlight-${highlight}` : ''}`}>
        {highlight && (
          <span className={`playback__highlight is-highlight-${highlight}`}>
            {t(`flow.highlight.${highlight}`)}
          </span>
        )}
        <span className="playback__description">{step?.description}</span>
      </div>
    </div>
  );
}
