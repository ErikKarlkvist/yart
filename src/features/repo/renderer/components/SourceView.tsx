import { type JSX, useEffect, useRef, useState } from 'react';
import { type SourceRef } from '@/common/model/flow';
import { t } from '@/common/model/i18n';
import { invokeChannel } from '@/common/renderer/ipc';
import { readSourceChannel, type SourceExcerpt } from '../../ipc/channels';
import { useRepo } from '../RepoContext';
import './source.css';
import { errorMessage } from '@/common/model/json';

interface Props {
  source: SourceRef;
  /** Commiten koden ska läsas ur när den inte är utcheckad */
  commit?: string | undefined;
}

type Result = { key: string; excerpt: SourceExcerpt } | { key: string; error: string };

/** Visar rader runt en källhänvisning i det valda repot. */
export function SourceView({ source, commit }: Props): JSX.Element {
  const { repo } = useRepo();
  const repoPath = repo?.path ?? null;
  const key = `${repoPath ?? ''}|${commit ?? ''}|${source.file}|${source.line}`;
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!repoPath) return;
    let cancelled = false;
    invokeChannel(readSourceChannel, {
      repoPath,
      file: source.file,
      line: source.line,
      ...(commit ? { commit } : {}),
    })
      .then((excerpt) => {
        if (!cancelled) setResult({ key, excerpt });
      })
      .catch((e: unknown) => {
        if (!cancelled) setResult({ key, error: errorMessage(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [repoPath, source.file, source.line, commit, key]);

  const current = result?.key === key ? result : null;
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    targetRef.current?.scrollIntoView({ block: 'center' });
  }, [current]);

  return (
    <div className="source">
      <div className="source__path">
        {source.file}:{source.line}
      </div>
      {!current && <p className="source__muted">{t('source.reading')}</p>}
      {current && 'error' in current && <p className="source__error">{current.error}</p>}
      {current && 'excerpt' in current && (
        <pre className="source__code">
          {current.excerpt.lines.map((text, i) => {
            const n = current.excerpt.startLine + i;
            return (
              <div
                key={n}
                ref={n === source.line ? targetRef : null}
                className={`source__line${n === source.line ? ' is-target' : ''}`}
              >
                <span className="source__n">{n}</span>
                <span className="source__text">{text || ' '}</span>
              </div>
            );
          })}
        </pre>
      )}
    </div>
  );
}
