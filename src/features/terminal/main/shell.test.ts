import { describe, expect, it } from 'vitest';
import { terminalShell } from './shell';

describe('terminalShell', () => {
  it('defaults to an interactive PowerShell on Windows without SHELL', () => {
    expect(terminalShell('win32', undefined)).toEqual({
      file: 'powershell.exe',
      args: ['-NoLogo', '-NoExit'],
    });
  });

  it.each([
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    'C:/Program Files/PowerShell/7/pwsh.exe',
    'POWERSHELL.EXE',
    '/usr/bin/pwsh',
  ])('keeps PowerShell interactive without a Unix login flag: %s', (file) => {
    expect(terminalShell('win32', file)).toEqual({ file, args: ['-NoLogo', '-NoExit'] });
  });

  it('starts cmd without a Unix login flag', () => {
    const file = 'C:\\Windows\\System32\\cmd.exe';
    expect(terminalShell('win32', file)).toEqual({ file, args: [] });
  });

  it.each([
    ['darwin', '/bin/zsh'],
    ['linux', '/bin/bash'],
    ['win32', 'C:\\Program Files\\Git\\bin\\bash.exe'],
  ])('preserves login startup for Unix shells on %s', (platform, file) => {
    expect(terminalShell(platform, file)).toEqual({ file, args: ['-l'] });
  });

  it('preserves the existing Unix default', () => {
    expect(terminalShell('darwin', undefined)).toEqual({ file: '/bin/zsh', args: ['-l'] });
  });
});
