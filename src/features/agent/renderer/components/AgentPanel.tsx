import { type JSX, useEffect, useId, useRef, useState } from 'react';
import { LOCALE, t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { invokeChannel } from '@/common/renderer/ipc';
import { useAgent } from '../AgentContext';
import { useSetup } from '@/features/mcp';
import { defaultBaseBranch, listBranchesChannel, useRepo } from '@/features/repo';
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
  const selectId = useId();
  const {
    conversations,
    activeId,
    mode,
    entries,
    state,
    lastPrompt,
    ask,
    stop,
    choose,
    startNew,
    selectMode,
  } = useAgent();
  const { repo } = useRepo();
  const { agent, approvalPolicy, setApprovalPolicy, accessModes, setAccessMode } = useSetup();
  const currentAgent = conversations.find((item) => item.id === activeId)?.agent ?? agent;
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [branchList, setBranchList] = useState<{ repoPath: string; branches: string[] } | null>(
    null,
  );
  const branches = repo?.isGit && branchList?.repoPath === repo.path ? branchList.branches : [];
  const [head, setHead] = useState('');
  const [base, setBase] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!repo?.isGit) return;
    let cancelled = false;
    void invokeChannel(listBranchesChannel, { repoPath: repo.path })
      .then((list) => {
        if (cancelled) return;
        setBranchList({ repoPath: repo.path, branches: list.branches });
        const nextHead = list.current ?? list.branches[0] ?? '';
        setHead(nextHead);
        setBase(defaultBaseBranch(list.branches, nextHead, null) ?? '');
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [repo?.path, repo?.branch, repo?.isGit]);

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
    const prompt =
      !activeId && mode === 'review' && !draft.trim()
        ? t('agent.reviewDefaultPrompt', { head, base })
        : draft.trim();
    if (!prompt || !hasRepo || state === 'busy') return;
    if (!activeId && !mode) return;
    if (
      !activeId &&
      mode === 'review' &&
      (!branches.includes(head) || !branches.includes(base) || head === base)
    )
      return;
    ask(prompt, !activeId && mode === 'review' ? { head, base } : undefined);
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

  const composer = (
    <div className={`agent__compose${activeId ? '' : ' agent__compose--initial'}`}>
      <textarea
        className="agent__input"
        rows={3}
        value={draft}
        disabled={!hasRepo}
        placeholder={t(`agent.placeholder.${mode ?? 'general'}`)}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            send();
          }
        }}
      />
      <div className="agent__compose-actions">
        <span className="agent__hint">{t('agent.sendHint')}</span>
        <button
          type="button"
          className="agent__send"
          disabled={
            !hasRepo ||
            state === 'busy' ||
            (!activeId && mode === 'review'
              ? !branches.includes(head) || !branches.includes(base) || head === base
              : draft.trim() === '')
          }
          onClick={send}
        >
          <Icon name="chat" size="sm" /> {t('agent.send')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="agent">
      <div className="agent__conversations">
        <div className="agent__conversations-bar">
          <label htmlFor={selectId}>{t('agent.conversations')}</label>
          <button
            type="button"
            className="text-button"
            disabled={!hasRepo}
            onClick={() => {
              startNew();
              setDraft('');
            }}
          >
            <Icon name="plus" size="sm" /> {t('agent.newConversation')}
          </button>
        </div>
        <select
          id={selectId}
          className="agent__conversation-select"
          value={activeId ?? ''}
          disabled={!hasRepo || conversations.length === 0}
          onChange={(event) => {
            choose(event.target.value);
            setDraft('');
          }}
        >
          {!activeId && <option value="">{t('agent.untitled')}</option>}
          {conversations.map((item) => (
            <option key={item.id} value={item.id}>
              {t(`agent.mode.${item.mode}`)}
              {item.reviewBranches
                ? ` (${item.reviewBranches.head} vs ${item.reviewBranches.base})`
                : ''}{' '}
              · {item.title || t('agent.untitled')} ·{' '}
              {new Date(item.updatedAt).toLocaleDateString(LOCALE)}
            </option>
          ))}
        </select>
      </div>
      {!activeId && (
        <div className="agent__mode-picker">
          <span className="agent__mode-heading">{t('agent.chooseMode')}</span>
          <div className="agent__mode-buttons">
            {(['analyse', 'review', 'plan'] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                className={`agent__mode-button agent__mode-button--${choice}${mode === choice ? ' is-selected' : ''}`}
                aria-pressed={mode === choice}
                disabled={!hasRepo}
                onClick={() => {
                  selectMode(choice);
                  setDraft('');
                }}
              >
                {t(`agent.mode.${choice}`)}
              </button>
            ))}
          </div>
          {mode && <p className="agent__mode-description">{t(`agent.modeDescription.${mode}`)}</p>}
        </div>
      )}
      {!activeId && mode === 'review' && (
        <div className="agent__review-branches">
          <label>
            <span>{t('agent.reviewHead')}</span>
            <select
              value={head}
              onChange={(event) => {
                const next = event.target.value;
                setHead(next);
                if (base === next) setBase(defaultBaseBranch(branches, next, null) ?? '');
              }}
            >
              {branches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('agent.reviewBase')}</span>
            <select
              value={base}
              onChange={(event) => {
                setBase(event.target.value);
              }}
            >
              {branches
                .filter((branch) => branch !== head)
                .map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
            </select>
          </label>
          {(!repo?.isGit || branches.length < 2) && (
            <p className="agent__hint">{t('agent.reviewNeedsBranches')}</p>
          )}
        </div>
      )}
      {!activeId && mode && composer}
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
      {currentAgent !== 'manual' && (
        <label className="agent__approval">
          <span>{t('agent.accessMode')}</span>
          <select
            value={accessModes[currentAgent]}
            onChange={(event) => {
              setAccessMode(
                currentAgent,
                event.target.value === 'workspace-write' ? 'workspace-write' : 'read-only',
              );
            }}
          >
            <option value="read-only">{t('agent.accessReadOnly')}</option>
            <option value="workspace-write">{t('agent.accessEditRepo')}</option>
          </select>
        </label>
      )}
      {currentAgent === 'codex' && (
        <label className="agent__approval">
          <span>{t('agent.approvalPolicy')}</span>
          <select
            value={approvalPolicy}
            onChange={(event) => {
              setApprovalPolicy(event.target.value === 'on-request' ? 'on-request' : 'never');
            }}
          >
            <option value="never">{t('agent.approvalNever')}</option>
            <option value="on-request">{t('agent.approvalReview')}</option>
          </select>
        </label>
      )}
      <div className="agent__scroll" ref={scroller}>
        {entries.length === 0 && activeId && (
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
      {activeId && composer}
    </div>
  );
}
