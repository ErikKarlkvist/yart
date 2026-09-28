import { describe, expect, it } from 'vitest';
import { AGENTS, agentStartCommand, codexInitialPrompt } from './agent';

describe('agentStartCommand', () => {
  it('gives claude the guide as system prompt', () => {
    expect(agentStartCommand('claude', '.reverik/instructions.md')).toBe(
      'claude --append-system-prompt-file .reverik/instructions.md',
    );
  });

  it('does not create a new codex chat just because a terminal opened', () => {
    expect(agentStartCommand('codex', '.reverik/instructions.md')).toBeNull();
  });

  it('resumes the exact saved codex session without submitting an extra prompt', () => {
    expect(
      agentStartCommand(
        'codex',
        '.reverik/instructions.md',
        '12345678-1234-1234-1234-123456789abc',
      ),
    ).toBe('codex resume 12345678-1234-1234-1234-123456789abc');
  });

  it('ignores an invalid saved session id', () => {
    expect(agentStartCommand('codex', '.reverik/instructions.md', 'session-123')).toBeNull();
  });

  it('uses the actual first request so new chat titles are useful', () => {
    expect(codexInitialPrompt('.reverik/instructions.md', 'Reverik', 3, 'Fix tab startup')).toBe(
      'Fix tab startup\n\nBefore responding, read .reverik/instructions.md and follow its instructions.',
    );
  });

  it('distinguishes an intentionally started idle chat by repository and tab', () => {
    const prompt = codexInitialPrompt('.reverik/instructions.md', 'Tickster', 3);
    expect(prompt).toContain('Tickster, tab 3');
    expect(prompt).toContain('.reverik/instructions.md');
  });

  it('starts nothing for a plain shell', () => {
    expect(agentStartCommand('shell', '.reverik/instructions.md')).toBeNull();
  });

  it('has a command decision for every agent', () => {
    for (const agent of AGENTS) expect(() => agentStartCommand(agent, 'x')).not.toThrow();
  });
});
