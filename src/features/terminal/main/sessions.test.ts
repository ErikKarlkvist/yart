import { beforeEach, describe, expect, it, vi } from 'vitest';

const { pty, spawn } = vi.hoisted(() => {
  const pty = {
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  };
  return { pty, spawn: vi.fn(() => pty) };
});

vi.mock('node-pty', () => ({ spawn }));

import { TerminalSessions } from './sessions';

describe('TerminalSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts Codex only once in a terminal, even if the start request is repeated', () => {
    const sessions = new TerminalSessions({
      onData: vi.fn(),
      onExit: vi.fn(),
      onCodexSession: vi.fn(),
    });
    const id = sessions.open('D:/repo', { cols: 80, rows: 24 });
    const request = {
      id,
      repoPath: 'D:/repo',
      tabId: 1,
      sessionId: '12345678-1234-1234-1234-123456789abc',
      prompt: null,
    };

    sessions.startCodex(request);
    sessions.startCodex(request);

    expect(pty.write).toHaveBeenCalledTimes(1);
    expect(pty.write).toHaveBeenCalledWith('codex resume 12345678-1234-1234-1234-123456789abc\r');
    sessions.closeAll();
  });
});
