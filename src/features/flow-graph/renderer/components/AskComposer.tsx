import { type JSX, type KeyboardEvent, useState } from 'react';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { askLabel, askSource, type AskTarget } from '../../model/ask';

interface Props {
  target: AskTarget;
  onSend: (question: string) => void;
  onCancel: () => void;
}

/** Frågerutan som ligger över grafen när något pekats ut. Enter kopierar frågan, Escape stänger. */
export function AskComposer({ target, onSend, onCancel }: Props): JSX.Element {
  const [question, setQuestion] = useState('');
  const label = askLabel(target);
  const source = askSource(target);
  const ready = question.trim().length > 0;

  const send = (): void => {
    if (ready) onSend(question);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') send();
    else if (event.key === 'Escape') onCancel();
  };

  return (
    <div className="graph-ask">
      <span className="graph-ask__target">
        <Icon name={target.kind === 'node' ? target.node.kind : 'link'} size="sm" />
        <span className="graph-ask__label">{label}</span>
        {source && (
          <span className="graph-ask__source">
            {source.file}:{source.line}
          </span>
        )}
      </span>
      <input
        type="text"
        className="graph-ask__input"
        autoFocus
        value={question}
        placeholder={t('ask.placeholder', { label })}
        onChange={(event) => {
          setQuestion(event.target.value);
        }}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="icon-button icon-button--primary"
        disabled={!ready}
        onClick={send}
        title={t('ask.send')}
        aria-label={t('ask.send')}
      >
        <Icon name="copy" />
      </button>
      <button
        type="button"
        className="icon-button icon-button--quiet"
        onClick={onCancel}
        title={t('ask.cancel')}
        aria-label={t('ask.cancel')}
      >
        <Icon name="close" size="sm" />
      </button>
    </div>
  );
}
