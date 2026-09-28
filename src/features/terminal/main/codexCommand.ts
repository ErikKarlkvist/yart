import { isCodexSessionId } from '../model/agent';

/** Quotes a first-turn prompt for the shell hosting the interactive Codex TUI. */
export function codexShellCommand(
  shellFile: string,
  sessionId: string | null,
  prompt: string | null,
): string | null {
  if (sessionId && isCodexSessionId(sessionId)) {
    if (!prompt?.trim()) return `codex resume ${sessionId}`;
    if (isCmdShell(shellFile)) return quoteThroughPowerShell(prompt, sessionId);
    return `codex resume ${sessionId} ${quotePrompt(shellFile, prompt)}`;
  }
  if (prompt === null) return null;
  if (isCmdShell(shellFile)) return quoteThroughPowerShell(prompt);

  return `codex ${quotePrompt(shellFile, prompt)}`;
}

function quotePrompt(shellFile: string, prompt: string): string {
  const shellName = shellFile.split(/[\\/]/).at(-1)?.toLowerCase() ?? '';
  if (['powershell', 'powershell.exe', 'pwsh', 'pwsh.exe'].includes(shellName)) {
    return quotePowerShell(prompt);
  }
  return quotePosix(prompt);
}

function isCmdShell(shellFile: string): boolean {
  const shellName = shellFile.split(/[\\/]/).at(-1)?.toLowerCase();
  return shellName === 'cmd' || shellName === 'cmd.exe';
}

function quotePowerShell(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function quotePosix(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

/** Base64 keeps arbitrary prompt text out of cmd.exe's metacharacter parser. */
function quoteThroughPowerShell(value: string, sessionId: string | null = null): string {
  const encoded = Buffer.from(value, 'utf8').toString('base64');
  const resume = sessionId ? `resume ${sessionId} ` : '';
  return `powershell.exe -NoLogo -NoProfile -Command "$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')); & codex ${resume}$p"`;
}
