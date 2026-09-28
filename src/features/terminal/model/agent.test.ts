import { describe, expect, it } from 'vitest';
import { AGENTS, agentStartCommand } from './agent';

describe('agentStartCommand', () => {
  it('gives claude the guide as system prompt', () => {
    expect(agentStartCommand('claude', '.reverik/instructions.md')).toBe(
      'claude --append-system-prompt-file .reverik/instructions.md',
    );
  });

  it('starts a new codex session when the tab has no saved session', () => {
    expect(agentStartCommand('codex', '.reverik/instructions.md')).toBe(
      'codex "Read .reverik/instructions.md now and follow it for the rest of this session."',
    );
  });

  it('resumes the exact codex session saved for the tab', () => {
    expect(
      agentStartCommand(
        'codex',
        '.reverik/instructions.md',
        '12345678-1234-1234-1234-123456789abc',
      ),
    ).toBe(
      'codex resume 12345678-1234-1234-1234-123456789abc "Read .reverik/instructions.md now and follow it for the rest of this session."',
    );
  });

  it('ignores an invalid saved session id', () => {
    expect(agentStartCommand('codex', '.reverik/instructions.md', 'session-123')).not.toContain(
      'codex resume',
    );
  });

  it('starts nothing for a plain shell', () => {
    expect(agentStartCommand('shell', '.reverik/instructions.md')).toBeNull();
  });

  it('has a command decision for every agent', () => {
    for (const agent of AGENTS) expect(() => agentStartCommand(agent, 'x')).not.toThrow();
  });
});
