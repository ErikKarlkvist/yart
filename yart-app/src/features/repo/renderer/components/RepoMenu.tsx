import { type JSX, useCallback, useRef, useState } from 'react';
import { t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { useClickOutside } from '@/common/renderer/useClickOutside';
import { useRepo } from '../RepoContext';
import './repo.css';

/**
 * Mappväljaren i fönsterraden: knappen visar valt repo, menyn listar
 * senaste repon, val av ny mapp, demot och omläsning av valt repo.
 */
export function RepoMenu(): JSX.Element {
  const { repo, recent, busy, open, forget, pickLocal, openDemo, fetch } = useRepo();
  const [isOpen, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);
  useClickOutside(root, isOpen, close);

  const choose = (action: () => Promise<void>): void => {
    setOpen(false);
    void action();
  };

  return (
    <div className="repo-menu" ref={root}>
      <button
        type="button"
        className="button repo-menu__button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={repo?.path ?? t('repo.none')}
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
        <span className="repo-menu__folder">
          <Icon name="folder" size="sm" />
        </span>
        <span className="repo-menu__name">{repo?.name ?? t('repo.folder')}</span>
        <span className="repo-menu__chevron">
          <Icon name="chevronDown" size="sm" />
        </span>
      </button>
      {isOpen && (
        <div className="repo-menu__popover" role="menu">
          {recent.length > 0 && (
            <>
              <div className="repo-menu__heading">{t('repo.recent')}</div>
              <ul className="repo-menu__list">
                {recent.map((r) => {
                  const active = r.path === repo?.path;
                  return (
                    <li key={r.path} className={`repo-menu__item${active ? ' is-active' : ''}`}>
                      <button
                        type="button"
                        role="menuitem"
                        className="repo-menu__open"
                        disabled={busy}
                        title={r.path}
                        onClick={() => {
                          choose(() => open(r.path));
                        }}
                      >
                        {r.name}
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-button--quiet"
                        title={t('repo.forget')}
                        aria-label={t('repo.forget')}
                        onClick={() => void forget(r.path)}
                      >
                        <Icon name="close" size="sm" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <div className="repo-menu__actions">
            {repo?.isGit && (
              <button
                type="button"
                role="menuitem"
                className="text-button"
                disabled={busy}
                onClick={() => {
                  choose(fetch);
                }}
              >
                {t('repo.reload')}
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => {
                choose(pickLocal);
              }}
            >
              {t('repo.pickFolder')}
            </button>
            <button
              type="button"
              role="menuitem"
              className="text-button"
              disabled={busy}
              onClick={() => {
                choose(openDemo);
              }}
            >
              {t('repo.loadDemo')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
