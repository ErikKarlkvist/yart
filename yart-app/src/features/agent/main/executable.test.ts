import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { agentExecutable } from './executable';

let directory: string;

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

describe('agentExecutable on Windows', () => {
  it('finds Codex inside an npm global install even when only the cmd shim is on PATH', async () => {
    directory = await mkdtemp(join(tmpdir(), 'yart-codex-cli-'));
    const binary = join(
      directory,
      'node_modules',
      '@openai',
      'codex',
      'node_modules',
      '@openai',
      'codex-win32-x64',
      'vendor',
      'x86_64-pc-windows-msvc',
      'bin',
      'codex.exe',
    );
    await mkdir(join(binary, '..'), { recursive: true });
    await writeFile(join(directory, 'codex.cmd'), '');
    await writeFile(binary, '');

    expect(agentExecutable('codex', { Path: directory }, 'win32', 'x64')).toBe(binary);
  });

  it('finds a native Codex executable directly on PATH', async () => {
    directory = await mkdtemp(join(tmpdir(), 'yart-codex-native-'));
    const binary = join(directory, 'codex.exe');
    await writeFile(binary, '');

    expect(agentExecutable('codex', { Path: directory }, 'win32', 'x64')).toBe(binary);
  });
});
