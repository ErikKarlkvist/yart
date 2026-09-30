import { type JSX } from 'react';
import { type FlowStep } from '@/common/model/flow';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { type Playback } from '../hooks/useFlowPlayback';
import { type FlowHighlight } from '../../model/highlight';

interface Props {
  steps: readonly FlowStep[];
  playback: Playback;
  highlights: ReadonlyMap<string, FlowHighlight>;
}

export function PlaybackControls({ steps, playback, highlights }: Props): JSX.Element {
  const step = steps[playback.stepIndex];
  const highlight = step ? highlights.get(step.edgeId) : undefined;
  const total = steps.length;

  return (
    <div className="playback">
      <div className="playback__buttons">
        <button
          type="button"
          className="icon-button"
          onClick={playback.restart}
          title={t('playback.restart')}
          aria-label={t('playback.restart')}
          disabled={total === 0}
        >
          <Icon name="restart" />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={playback.prev}
          title={t('playback.previous')}
          aria-label={t('playback.previous')}
          disabled={playback.stepIndex <= 0}
        >
          <Icon name="stepBack" />
        </button>
        <button
          type="button"
          className="icon-button icon-button--primary playback__play"
          onClick={playback.toggle}
          title={playback.playing ? t('playback.pause') : t('playback.play')}
          aria-label={playback.playing ? t('playback.pause') : t('playback.play')}
          disabled={total === 0}
        >
          <Icon name={playback.playing ? 'pause' : 'play'} size="lg" />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={playback.next}
          title={t('playback.next')}
          aria-label={t('playback.next')}
          disabled={playback.atEnd}
        >
          <Icon name="stepForward" />
        </button>
      </div>
      <input
        className="playback__scrubber"
        type="range"
        min={0}
        max={Math.max(0, total - 1)}
        value={Math.max(0, playback.stepIndex)}
        onChange={(e) => {
          playback.goTo(Number(e.target.value));
        }}
        aria-label={t('playback.step')}
      />
      <div className={`playback__text${highlight ? ` is-highlight-${highlight}` : ''}`}>
        <span className="playback__counter">
          {playback.stepIndex + 1}/{total}
        </span>
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
