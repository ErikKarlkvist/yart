import { type JSX, useEffect, useRef, useState } from 'react';
import { LOCALE, t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { useAgent } from '../AgentContext';
import './agent.css';

/** Claude Code säger så när inloggningen i CLI:n gått ut. */
function isLoginError(text: string): boolean {
  return /authenticat|log ?in|oauth/i.test(text);
}

/**
 * Samtalet med agenten som appen kör i bakgrunden: frågor från grafen och
 * egna frågor, agentens svar och verktyg, och fel med prompten att kopiera
 * när agenten inte gick att nå.
 */
export function AgentPanel({ hasRepo }: { hasRepo: boolean }): JSX.Element {
  const { entries, state, lastPrompt, ask, stop } = useAgent();
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [entries, state]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => {
      setCopied(false);
    }, 1500);
    return () => {
      clearTimeout(id);
    };
  }, [copied]);

  const send = (): void => {
    const prompt = draft.trim();
    if (!prompt || !hasRepo) return;
    ask(prompt);
    setDraft('');
  };
  const copyPrompt = (): void => {
    if (!lastPrompt) return;
    navigator.clipboard
      .writeText(lastPrompt)
      .then(() => {
        setCopied(true);
      })
      .catch(console.error);
  };

  const running = state === 'busy' || state === 'idle';

  return (
    <div className="agent">
      <div className="agent__bar">
        <span className={`agent__state is-${state}`}>
          <span className="agent__dot" /> {t(`agent.state.${state}`)}
        </span>
        {running && (
          <button type="button" className="text-button" onClick={stop}>
            {t('agent.stop')}
          </button>
        )}
      </div>
      <div className="agent__scroll" ref={scroller}>
        {entries.length === 0 && (
          <p className="shell__empty shell__empty--padded">
            {hasRepo ? t('agent.empty') : t('app.chooseRepo')}
          </p>
        )}
        <ol className="agent__list">
          {entries.map((entry, index) => (
            <li key={`${entry.at}:${index}`} className={`agent__entry agent__entry--${entry.kind}`}>
              {entry.kind === 'tool' ? (
                <span className="agent__tool">
                  <Icon name="link" size="sm" /> {entry.name}
                </span>
              ) : (
                <>
                  <span className="agent__time">
                    {new Date(entry.at).toLocaleTimeString(LOCALE, { timeStyle: 'short' })}
                  </span>
                  <p className="agent__text">{entry.text}</p>
                  {entry.kind === 'error' && isLoginError(entry.text) && (
                    <p className="agent__hint">{t('agent.loginHint')}</p>
                  )}
                  {entry.kind === 'error' && lastPrompt && (
                    <button type="button" className="text-button" onClick={copyPrompt}>
                      <Icon name="copy" size="sm" />{' '}
                      {copied ? t('side.copied') : t('agent.copyPrompt')}
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
          {state === 'busy' && (
            <li className="agent__entry agent__entry--busy">{t('agent.working')}</li>
          )}
        </ol>
      </div>
      <div className="agent__compose">
        <textarea
          className="agent__input"
          rows={3}
          value={draft}
          disabled={!hasRepo}
          placeholder={t('agent.placeholder')}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send();
          }}
        />
        <div className="agent__compose-actions">
          <span className="agent__hint">{t('agent.sendHint')}</span>
          <button
            type="button"
            className="agent__send"
            disabled={!hasRepo || draft.trim() === ''}
            onClick={send}
          >
            <Icon name="chat" size="sm" /> {t('agent.send')}
          </button>
        </div>
      </div>
    </div>
  );
}
