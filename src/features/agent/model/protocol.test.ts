import { describe, expect, it } from 'vitest';
import { claudeLaunch, parseAgentLine, userMessageLine } from './protocol';

describe('claudeLaunch', () => {
  it('kör headless med strömmande JSON, bara Reveriks MCP-server och läsverktyg', () => {
    const launch = claudeLaunch('http://127.0.0.1:7390/mcp', 'SKILL');
    expect(launch.command).toBe('claude');
    expect(launch.args).toContain('--strict-mcp-config');
    expect(launch.args.join(' ')).toContain('"url":"http://127.0.0.1:7390/mcp"');
    expect(launch.args).toContain('mcp__reverik__save_flow');
    expect(launch.args).not.toContain('Edit');
    expect(launch.args.at(-1)).toBe('SKILL');
  });
});

describe('userMessageLine', () => {
  it('är en JSON-rad med användarrollen', () => {
    expect(JSON.parse(userMessageLine('hej'))).toEqual({
      type: 'user',
      message: { role: 'user', content: 'hej' },
    });
    expect(userMessageLine('hej').endsWith('\n')).toBe(true);
  });
});

describe('parseAgentLine', () => {
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
    expect(parseAgentLine(line)).toEqual([
      { type: 'text', text: 'Saved.' },
      { type: 'tool', name: 'save_flow' },
      { type: 'tool', name: 'Read' },
    ]);
  });

  it('ser när svaret är klart och om det gick fel', () => {
    expect(parseAgentLine(JSON.stringify({ type: 'result', subtype: 'success' }))).toEqual([
      { type: 'done', error: null },
    ]);
    expect(
      parseAgentLine(
        JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: 'Failed' }),
      ),
    ).toEqual([{ type: 'done', error: 'Failed' }]);
    expect(parseAgentLine(JSON.stringify({ type: 'result', subtype: 'error_max_turns' }))).toEqual([
      { type: 'done', error: 'error_max_turns' },
    ]);
  });

  it('ignorerar init, verktygsresultat och skräp', () => {
    expect(parseAgentLine(JSON.stringify({ type: 'system', subtype: 'init' }))).toEqual([]);
    expect(parseAgentLine(JSON.stringify({ type: 'user', message: { content: [] } }))).toEqual([]);
    expect(parseAgentLine('not json')).toEqual([]);
  });
});
