import { describe, expect, it } from 'vitest';
import { codexConfigSnippet, connectCommand } from './agents';

describe('connectCommand', () => {
  const url = 'http://127.0.0.1:7390/mcp';

  it('ger kommandot per agent och inget för manuell koppling', () => {
    expect(connectCommand('claude', url)).toBe(
      'claude mcp add --transport http yart http://127.0.0.1:7390/mcp',
    );
    expect(connectCommand('codex', url)).toBe('codex mcp add yart --url http://127.0.0.1:7390/mcp');
    expect(connectCommand('manual', url)).toBeNull();
  });

  it('ger config-snutten för Codex', () => {
    expect(codexConfigSnippet(url)).toBe('[mcp_servers.yart]\nurl = "http://127.0.0.1:7390/mcp"');
  });
});
