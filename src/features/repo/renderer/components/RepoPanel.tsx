import { type JSX } from 'react';
import { t } from '@/common/model/i18n';
import { useRepo } from '../RepoContext';
import { RepoCard } from './RepoCard';
import './repo.css';

/** Kortet med det valda repot. Val av repo sker i fönsterradens meny. */
export function RepoPanel(): JSX.Element {
  const { repo, busy, error, clearError, fetch } = useRepo();

  return (
    <section className="repo">
      <h2 className="repo__heading">{t('repo.heading')}</h2>

      {repo ? (
        <RepoCard repo={repo} busy={busy} onReload={() => void fetch()} />
      ) : (
        <p className="repo__muted">{t('repo.none')}</p>
      )}

      {error && (
        <p className="repo__error" onClick={clearError}>
          {error}
        </p>
      )}
    </section>
  );
}
