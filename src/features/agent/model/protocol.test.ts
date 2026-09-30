import { describe, expect, it } from 'vitest';
import { claudeRunner, codexRunner, parseClaudeLine, parseCodexLine } from './protocol';

const input = {
  mcpUrl: 'http://127.0.0.1:7390/mcp',
  skill: 'SKILL',
  prompt: 'hej',
  threadId: null,
  permission: 'auto' as const,
  model: 'default',
};

describe('claudeRunner', () => {
  it('kör headless med strömmande JSON och bara Reveriks MCP-server', () => {
    const launch = claudeRunner.launch(input);
    expect(launch.command).toBe('claude');
    expect(launch.args).toContain('--strict-mcp-config');
    expect(launch.args.join(' ')).toContain('"url":"http://127.0.0.1:7390/mcp"');
    expect(launch.args).toContain('mcp__reverik__save_flow');
    expect(launch.args).not.toContain('Edit');
    expect(launch.args.at(-1)).toBe('SKILL');
    expect(JSON.parse(launch.stdin ?? '')).toEqual({
      type: 'user',
      message: { role: 'user', content: 'hej' },
    });
    expect(claudeRunner.message('igen').endsWith('\n')).toBe(true);
    expect(launch.args).toContain('acceptEdits');
    expect(launch.args).not.toContain('--tools');
    expect(launch.args).not.toContain('--model');
    expect(launch.args).toContain('mcp__reverik__permission_prompt');
    expect(launch.env?.MCP_TOOL_TIMEOUT).toBeDefined();
    const manual = claudeRunner.launch({ ...input, permission: 'manual', model: 'opus' });
    expect(manual.args).toContain('default');
    expect(manual.args).not.toContain('acceptEdits');
    expect(manual.args.join(' ')).toContain('--model opus');
    const resumed = claudeRunner.launch({ ...input, threadId: 'session-1' });
    expect(resumed.args.slice(-2)).toEqual(['--resume', 'session-1']);
  });
});

describe('codexRunner', () => {
  it('startar en tråd med skillen först och fortsätter den sedan per id', () => {
    const first = codexRunner.launch(input);
    expect(first.command).toBe('codex');
    expect(first.args.slice(0, 2)).toEqual(['exec', '--json']);
    expect(first.args).toContain('workspace-write');
    expect(first.args).not.toContain('-m');
    expect(first.args).toContain('approval_policy="never"');
    expect(first.args).toContain('mcp_servers.reverik.url="http://127.0.0.1:7390/mcp"');
    for (const tool of ['save_flow', 'save_document', 'save_review']) {
      expect(first.args).toContain(`mcp_servers.reverik.tools.${tool}.approval_mode="approve"`);
    }
    expect(first.args.at(-1)).toBe('-');
    expect(first.stdin).toContain('SKILL');
    expect(first.stdin).toContain('hej');

    const next = codexRunner.launch({ ...input, prompt: 'mer', threadId: 'abc' });
    expect(next.args.slice(0, 3)).toEqual(['exec', 'resume', '--json']);
    expect(next.args).not.toContain('--sandbox');
    expect(next.args).toContain('sandbox_mode="workspace-write"');
    expect(next.args).toContain('mcp_servers.reverik.tools.save_flow.approval_mode="approve"');
    expect(next.args.slice(-2)).toEqual(['abc', '-']);
    expect(next.stdin).toBe('mer');
    const reviewed = codexRunner.launch({ ...input, permission: 'manual' });
    expect(reviewed.args).toContain('approval_policy="on-request"');
    expect(reviewed.args).toContain('approvals_reviewer="auto_review"');
  });
});

describe('parseClaudeLine', () => {
  it('plockar text och verktyg ur assistentmeddelanden', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Saved.' },
          { type: 'tool_use', name: 'mcp__reverik__save_flow', input: {} },
          { type: 'tool_use', name: 'Read', input: {} },
        ],
      },
    });
    expect(parseClaudeLine(line)).toEqual([
      { type: 'text', text: 'Saved.' },
      { type: 'tool', name: 'save_flow' },
      { type: 'tool', name: 'Read' },
    ]);
  });

  it('ser när svaret är klart och om det gick fel', () => {
    expect(parseClaudeLine(JSON.stringify({ type: 'result', subtype: 'success' }))).toEqual([
      { type: 'done', error: null },
    ]);
    expect(
      parseClaudeLine(
        JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: 'Failed' }),
      ),
    ).toEqual([{ type: 'done', error: 'Failed' }]);
    expect(parseClaudeLine(JSON.stringify({ type: 'result', subtype: 'error_max_turns' }))).toEqual(
      [{ type: 'done', error: 'error_max_turns' }],
    );
  });

  it('ignorerar init, verktygsresultat och skräp', () => {
    expect(
      parseClaudeLine(JSON.stringify({ type: 'system', subtype: 'init', session_id: 'session-1' })),
    ).toEqual([{ type: 'thread', id: 'session-1' }]);
    expect(parseClaudeLine(JSON.stringify({ type: 'system', subtype: 'init' }))).toEqual([]);
    expect(parseClaudeLine(JSON.stringify({ type: 'user', message: { content: [] } }))).toEqual([]);
    expect(parseClaudeLine('not json')).toEqual([]);
  });
});

describe('parseCodexLine', () => {
  it('följer tråd, verktyg, text och avslut', () => {
    expect(parseCodexLine(JSON.stringify({ type: 'thread.started', thread_id: 't1' }))).toEqual([
      { type: 'thread', id: 't1' },
    ]);
    expect(
      parseCodexLine(
        JSON.stringify({
          type: 'item.started',
          item: { type: 'mcp_tool_call', server: 'reverik', tool: 'save_flow' },
        }),
      ),
    ).toEqual([{ type: 'tool', name: 'save_flow' }]);
    expect(
      parseCodexLine(
        JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'Done.' } }),
      ),
    ).toEqual([{ type: 'text', text: 'Done.' }]);
    expect(parseCodexLine(JSON.stringify({ type: 'turn.completed', usage: {} }))).toEqual([
      { type: 'done', error: null },
    ]);
  });

  it('gör fel till avslut med text', () => {
    expect(parseCodexLine(JSON.stringify({ type: 'error', message: 'Not logged in' }))).toEqual([
      { type: 'done', error: 'Not logged in' },
    ]);
    expect(
      parseCodexLine(JSON.stringify({ type: 'turn.failed', error: { message: 'boom' } })),
    ).toEqual([{ type: 'done', error: 'boom' }]);
    expect(
      parseCodexLine(JSON.stringify({ type: 'item.started', item: { type: 'reasoning' } })),
    ).toEqual([]);
  });
});
