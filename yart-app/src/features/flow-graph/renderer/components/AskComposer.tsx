import { type JSX, type KeyboardEvent, useEffect, useState } from 'react';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { askLabel, askSource, type AskTarget } from '../../model/ask';

interface Props {
  target: AskTarget;
  /** Utkastet ägs av spelaren, så det överlever att målet byts */
  question: string;
  onChange: (question: string) => void;
  onSend: () => void;
  onCopy: () => Promise<void>;
  onCancel: () => void;
}

/** Frågerutan som ligger över grafen när något pekats ut. Enter skickar, Escape stänger. */
export function AskComposer({
  target,
  question,
  onChange,
  onSend,
  onCopy,
  onCancel,
}: Props): JSX.Element {
  const [copied, setCopied] = useState(false);
  const label = askLabel(target);
  const source = askSource(target);
  const ready = question.trim().length > 0;

  const send = (): void => {
    if (ready) onSend();
  };
  const copy = (): void => {
    if (!ready) return;
    onCopy()
      .then(() => {
        setCopied(true);
      })
      .catch(console.error);
  };
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => {
      setCopied(false);
    }, 1500);
    return () => {
      clearTimeout(id);
    };
  }, [copied]);
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
          onChange(event.target.value);
          setCopied(false);
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
        <Icon name="chat" />
      </button>
      <button
        type="button"
        className="icon-button icon-button--quiet"
        disabled={!ready}
        onClick={copy}
        title={copied ? t('side.copied') : t('ask.copy')}
        aria-label={copied ? t('side.copied') : t('ask.copy')}
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
