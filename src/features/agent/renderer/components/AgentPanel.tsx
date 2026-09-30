import { type JSX, useEffect, useId, useRef, useState } from 'react';
import { LOCALE, t } from '@/common/model/i18n';
import { Icon } from '@/common/renderer/Icon';
import { invokeChannel } from '@/common/renderer/ipc';
import { AGENT_PERMISSIONS, DEFAULT_CHOICE } from '@/common/model/agent';
import { useAgent } from '../AgentContext';
import { useAgentModels } from '../useAgentModels';
import { groupEntries } from '../../model/groupEntries';
import { useSetup } from '@/features/mcp';
import { defaultBaseBranch, listBranchesChannel, useRepo } from '@/features/repo';
import './agent.css';

/** Claude Code säger så när inloggningen i CLI:n gått ut. */
/** Värdet i konversationsväljaren som startar en ny konversation */
const NEW = '__new__';

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
    approvals,
    answer,
  } = useAgent();
  const { repo } = useRepo();
  const { agent, permission, setPermission, models, setModel, efforts, setEffort } = useSetup();
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
  }, [entries, state, approvals]);

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

  const busy = state === 'busy';
  const agentModels = useAgentModels(currentAgent === 'manual' ? null : currentAgent);
  // Utan svar från agenten finns bara standardvalet, och ett sparat val som försvunnit visas som det
  const modelOptions = agentModels.some((m) => m.value === DEFAULT_CHOICE)
    ? agentModels
    : [
        {
          value: DEFAULT_CHOICE,
          label: t('agent.modelDefault'),
          description: '',
          effortLevels: [],
        },
        ...agentModels,
      ];
  const chosenModel =
    currentAgent === 'manual'
      ? DEFAULT_CHOICE
      : modelOptions.some((m) => m.value === models[currentAgent])
        ? models[currentAgent]
        : DEFAULT_CHOICE;
  const effortLevels = modelOptions.find((m) => m.value === chosenModel)?.effortLevels ?? [];
  const chosenEffort =
    currentAgent !== 'manual' && effortLevels.includes(efforts[currentAgent])
      ? efforts[currentAgent]
      : DEFAULT_CHOICE;

  const composer = (
    <div className="agent__compose">
      {!activeId && <p className="agent__mode-description">{t(`agent.modeDescription.${mode}`)}</p>}
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
      {!activeId && (
        <div className="agent__mode-picker">
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
        </div>
      )}
      <select
        id={selectId}
        className="agent__conversation-select"
        aria-label={t('agent.conversations')}
        value={activeId ?? NEW}
        disabled={!hasRepo}
        onChange={(event) => {
          if (event.target.value === NEW) startNew();
          else choose(event.target.value);
          setDraft('');
        }}
      >
        <option value={NEW}>{t('agent.untitled')}</option>
        {conversations.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title || t('agent.untitled')} ·{' '}
            {new Date(item.updatedAt).toLocaleDateString(LOCALE)}
          </option>
        ))}
      </select>
      <textarea
        className="agent__input"
        rows={3}
        value={draft}
        disabled={!hasRepo}
        placeholder={t(`agent.placeholder.${mode}`)}
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
        {currentAgent !== 'manual' && (
          <select
            className="agent__setting"
            value={permission}
            title={t('agent.permissionHint')}
            aria-label={t('agent.permissionLabel')}
            onChange={(event) => {
              const next = AGENT_PERMISSIONS.find((option) => option === event.target.value);
              if (next) setPermission(next);
            }}
          >
            {AGENT_PERMISSIONS.map((option) => (
              <option key={option} value={option}>
                {t(`agent.permission.${option}`)}
              </option>
            ))}
          </select>
        )}
        {currentAgent !== 'manual' && modelOptions.length > 1 && (
          <select
            className="agent__setting"
            value={chosenModel}
            title={modelOptions.find((m) => m.value === chosenModel)?.description}
            aria-label={t('agent.modelLabel')}
            onChange={(event) => {
              const next = modelOptions.find((m) => m.value === event.target.value);
              setModel(currentAgent, event.target.value);
              // En effort den nya modellen saknar gäller inte längre
              if (next && !next.effortLevels.includes(efforts[currentAgent]))
                setEffort(currentAgent, DEFAULT_CHOICE);
            }}
          >
            {modelOptions.map((option) => (
              <option key={option.value} value={option.value} title={option.description}>
                {option.label}
              </option>
            ))}
          </select>
        )}
        {currentAgent !== 'manual' && effortLevels.length > 0 && (
          <select
            className="agent__setting"
            value={chosenEffort}
            aria-label={t('agent.effortLabel')}
            onChange={(event) => {
              setEffort(currentAgent, event.target.value);
            }}
          >
            <option value={DEFAULT_CHOICE}>{t('agent.effortDefault')}</option>
            {effortLevels.map((level) => (
              <option key={level} value={level}>
                {capitalise(level)}
              </option>
            ))}
          </select>
        )}
        <span className="agent__spacer" />
        {busy && (
          <button
            type="button"
            className="icon-button agent__stop"
            title={t('agent.stop')}
            aria-label={t('agent.stop')}
            onClick={stop}
          >
            <Icon name="stop" size="sm" />
          </button>
        )}
        <button
          type="button"
          className="agent__send"
          disabled={
            !hasRepo ||
            busy ||
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
      <div className="agent__scroll" ref={scroller}>
        {entries.length === 0 && (
          <p className="shell__empty shell__empty--padded">
            {hasRepo ? t('agent.empty') : t('app.chooseRepo')}
          </p>
        )}
        <ol className="agent__list">
          {groupEntries(entries).map((group) =>
            group.kind === 'tools' ? (
              <ToolGroup key={group.key} names={group.tools.map((tool) => tool.name)} />
            ) : (
              <li key={group.key} className={`agent__entry agent__entry--${group.entry.kind}`}>
                <>
                  <span className="agent__time">
                    {new Date(group.entry.at).toLocaleTimeString(LOCALE, { timeStyle: 'short' })}
                  </span>
                  <p className="agent__text">{group.entry.text}</p>
                  {group.entry.kind === 'error' && isLoginError(group.entry.text) && (
                    <p className="agent__hint">{t('agent.loginHint')}</p>
                  )}
                  {group.entry.kind === 'error' && lastPrompt && (
                    <button type="button" className="text-button" onClick={copyPrompt}>
                      <Icon name="copy" size="sm" />{' '}
                      {copied ? t('side.copied') : t('agent.copyPrompt')}
                    </button>
                  )}
                </>
              </li>
            ),
          )}
          {approvals.map((approval) => (
            <li key={approval.id} className="agent__entry agent__entry--approval">
              <p className="agent__approval-title">
                {t('agent.approvalAsk', { tool: approval.tool })}
              </p>
              <code className="agent__approval-detail">{approval.detail}</code>
              <div className="agent__approval-actions">
                <button
                  type="button"
                  className="agent__allow"
                  onClick={() => {
                    answer(approval.id, true);
                  }}
                >
                  {t('agent.allow')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    answer(approval.id, false);
                  }}
                >
                  {t('agent.deny')}
                </button>
              </div>
            </li>
          ))}
          {busy && approvals.length === 0 && (
            <li className="agent__entry agent__entry--busy">{t('agent.working')}</li>
          )}
        </ol>
      </div>
      {composer}
    </div>
  );
}

/** Effort-nivåerna kommer från agenten som gemener, t.ex. `high` */
function capitalise(text: string): string {
  return `${(text[0] ?? '').toUpperCase()}${text.slice(1)}`;
}

/**
 * Verktygsanrop i följd som en rad: det senaste anropet och hur många det
 * var. Klick fäller ut hela listan.
 */
function ToolGroup({ names }: { names: string[] }): JSX.Element {
  const [open, setOpen] = useState(false);
  const latest = names.at(-1) ?? '';
  return (
    <li className="agent__entry agent__entry--tool">
      <button
        type="button"
        className="agent__tool"
        aria-expanded={open}
        disabled={names.length < 2}
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
        <Icon name="link" size="sm" /> {latest}
        {names.length > 1 && (
          <span className="agent__tool-count">{t('agent.toolCalls', { count: names.length })}</span>
        )}
        {names.length > 1 && <Icon name={open ? 'chevronDown' : 'chevronRight'} size="sm" />}
      </button>
      {open && (
        <ol className="agent__tool-list">
          {names.map((name, i) => (
            <li key={i}>{name}</li>
          ))}
        </ol>
      )}
    </li>
  );
}
