import { describe, expect, it } from 'vitest';
import { codexShellCommand } from './codexCommand';

describe('codexShellCommand', () => {
  it('resumes a saved chat without sending a new user turn', () => {
    expect(codexShellCommand('powershell.exe', '12345678-1234-1234-1234-123456789abc', null)).toBe(
      'codex resume 12345678-1234-1234-1234-123456789abc',
    );
  });

  it('can resume a saved chat with the real user request as its next turn', () => {
    expect(
      codexShellCommand(
        'powershell.exe',
        '12345678-1234-1234-1234-123456789abc',
        'Fix tab startup',
      ),
    ).toBe("codex resume 12345678-1234-1234-1234-123456789abc 'Fix tab startup'");
  });

  it('quotes a new prompt as a literal in PowerShell', () => {
    expect(codexShellCommand('pwsh.exe', null, "It's $value; don't expand")).toBe(
      "codex 'It''s $value; don''t expand'",
    );
  });

  it('quotes single quotes safely in a POSIX shell', () => {
    expect(codexShellCommand('/bin/bash', null, "It's safe")).toBe("codex 'It'\\''s safe'");
  });

  it('keeps arbitrary prompt text out of cmd.exe parsing', () => {
    const command = codexShellCommand('C:\\Windows\\System32\\cmd.exe', null, 'Fix %PATH% & !');
    expect(command).toMatch(/^powershell\.exe /);
    expect(command).not.toContain('Fix %PATH% & !');
  });
});
