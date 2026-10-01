import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Resolve a native executable; Node cannot start an npm `.cmd` shim with execFile/spawn. */
export function agentExecutable(
  command: string,
  env: NodeJS.ProcessEnv,
  platform = process.platform,
  arch = process.arch,
): string {
  if (platform !== 'win32' || (command !== 'codex' && command !== 'claude')) return command;
  const pathEntry = Object.entries(env).find(([key]) => key.toLowerCase() === 'path');
  const directories = (pathEntry?.[1] ?? '').split(';').filter(Boolean);

  for (const entry of directories) {
    const directory = entry.replace(/^"|"$/g, '');
    const direct = join(directory, `${command}.exe`);
    if (existsSync(direct)) return direct;
    if (command !== 'codex' || !existsSync(join(directory, 'codex.cmd'))) continue;

    const target = arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
    const packageName = arch === 'arm64' ? 'codex-win32-arm64' : 'codex-win32-x64';
    const packageRoot = join(directory, 'node_modules', '@openai', 'codex');
    const binary = join('vendor', target, 'bin', 'codex.exe');
    for (const base of [
      join(packageRoot, 'node_modules', '@openai', packageName),
      join(directory, 'node_modules', '@openai', packageName),
      packageRoot,
    ]) {
      const candidate = join(base, binary);
      if (existsSync(candidate)) return candidate;
    }
  }
  return command;
}
