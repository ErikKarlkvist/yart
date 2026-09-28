import { describe, expect, it } from 'vitest';
import { candidatePorts, DEFAULT_MCP_PORT, mcpUrl } from './mcp';

describe('candidatePorts', () => {
  it('prövar standardporten och några uppåt', () => {
    const ports = candidatePorts(undefined);
    expect(ports[0]).toBe(DEFAULT_MCP_PORT);
    expect(ports).toHaveLength(10);
  });

  it('låser till miljövariabeln när den är en port', () => {
    expect(candidatePorts('9001')).toEqual([9001]);
    expect(candidatePorts('abc')[0]).toBe(DEFAULT_MCP_PORT);
  });
});

describe('mcpUrl', () => {
  it('pekar på loopback och MCP-sökvägen', () => {
    expect(mcpUrl(7390)).toBe('http://127.0.0.1:7390/mcp');
  });
});
