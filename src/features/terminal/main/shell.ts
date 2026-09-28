interface ShellConfig {
  file: string;
  args: string[];
}

/** Inloggningsflaggan hör till Unix-skal och får inte skickas till PowerShell eller cmd. */
export function terminalShell(platform: string, shell: string | undefined): ShellConfig {
  const file = shell ?? (platform === 'win32' ? 'powershell.exe' : '/bin/zsh');
  const name = file.split(/[/\\]/).at(-1)?.toLowerCase();

  if (
    name === 'powershell.exe' ||
    name === 'powershell' ||
    name === 'pwsh.exe' ||
    name === 'pwsh'
  ) {
    return { file, args: ['-NoLogo', '-NoExit'] };
  }
  if (name === 'cmd.exe' || name === 'cmd') return { file, args: [] };
  return { file, args: ['-l'] };
}
