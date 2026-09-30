import { type JSX, useEffect, useState } from 'react';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';

interface Props {
  /** Texten för agenten, byggs först vid klick */
  build: () => string;
  copyLabel: string;
  hint: string;
  /** Saknas när ingen agent körs i appen, då finns bara kopiering */
  onSend?: ((text: string) => void) | undefined;
  disabled?: boolean;
}

/** Knapparna under ett dokument: kopiera texten för AI eller skicka den till agenten. */
export function AiActions({
  build,
  copyLabel,
  hint,
  onSend,
  disabled = false,
}: Props): JSX.Element {
  const [done, setDone] = useState<'copied' | 'sent' | null>(null);

  useEffect(() => {
    if (done === null) return;
    const id = setTimeout(() => {
      setDone(null);
    }, 1500);
    return () => {
      clearTimeout(id);
    };
  }, [done]);

  return (
    <div className="ai-actions">
      <span className="ai-actions__hint">{hint}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          void navigator.clipboard.writeText(build()).then(() => {
            setDone('copied');
          });
        }}
      >
        <Icon name="copy" size="sm" /> {done === 'copied' ? t('plan.copied') : copyLabel}
      </button>
      {onSend && (
        <button
          type="button"
          className="ai-actions__send"
          disabled={disabled}
          onClick={() => {
            onSend(build());
            setDone('sent');
          }}
        >
          <Icon name="chat" size="sm" /> {done === 'sent' ? t('plan.sent') : t('plan.send')}
        </button>
      )}
    </div>
  );
}
