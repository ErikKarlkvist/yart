import { type JSX } from 'react';
import { t } from '@/common/model/i18n';
import { type FlowPaths } from './FlowPlayer';
import './graph.css';

/**
 * Flödets vägval: ett alternativ per rad med frågan till vänster och en flik
 * per gren till höger. Bara de alternativ uppspelningen passerar visas.
 */
export function PathsPanel({ paths }: { paths: FlowPaths }): JSX.Element {
  return (
    <ul className="paths" aria-label={t('playback.paths')}>
      {paths.alts.map(({ key, alt, selected }) => (
        <li key={key} className="paths__row">
          <span className="paths__question" title={alt.alt}>
            {alt.alt}
          </span>
          <span className="paths__branches" role="group" aria-label={alt.alt}>
            {alt.branches.map((branch, index) => (
              <button
                key={index}
                type="button"
                className={`paths__branch${index === selected ? ' is-selected' : ''}`}
                aria-pressed={index === selected}
                title={t('sequence.chooseBranch', { label: branch.label })}
                onClick={() => {
                  paths.choose(key, index);
                }}
              >
                {branch.label}
              </button>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
