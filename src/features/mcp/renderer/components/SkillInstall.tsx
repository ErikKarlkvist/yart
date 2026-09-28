import { type JSX, useState } from 'react';
import { t } from '@/common/model/i18n';
import { type McpStatus } from '../../model/mcp';

interface Props {
  status: McpStatus;
  onInstall: () => Promise<void>;
  /** Visa sökvägen skillen skrivs till */
  showPath: boolean;
}

/** Skillens tillstånd och knappen som installerar eller uppdaterar den. */
export function SkillInstall({ status, onInstall, showPath }: Props): JSX.Element {
  const [installing, setInstalling] = useState(false);
  const install = (): void => {
    setInstalling(true);
    onInstall()
      .catch(console.error)
      .finally(() => {
        setInstalling(false);
      });
  };

  return (
    <>
      <div className="connect__command">
        <span className={`connect__skill is-${status.skill.state}`}>
          {t(`connect.skill.${status.skill.state}`)}
        </span>
        <button
          type="button"
          className="text-button"
          disabled={installing || status.skill.state === 'current'}
          onClick={install}
        >
          {status.skill.state === 'missing' ? t('connect.install') : t('connect.update')}
        </button>
      </div>
      {showPath && <code className="connect__code connect__code--muted">{status.skill.path}</code>}
    </>
  );
}
