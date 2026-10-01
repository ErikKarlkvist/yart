import { type JSX, useEffect, useState } from 'react';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';

/** Ett kommando i en kodruta med en kopieringsknapp som kvitterar. */
export function CommandCopy({ command }: { command: string }): JSX.Element {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => {
      setCopied(false);
    }, 1500);
    return () => {
      clearTimeout(id);
    };
  }, [copied]);

  const copy = (): void => {
    navigator.clipboard
      .writeText(command)
      .then(() => {
        setCopied(true);
      })
      .catch(console.error);
  };

  return (
    <div className="connect__command">
      <code className="connect__code">{command}</code>
      <button type="button" className="text-button" onClick={copy}>
        <Icon name="copy" size="sm" /> {copied ? t('side.copied') : t('side.copy')}
      </button>
    </div>
  );
}
