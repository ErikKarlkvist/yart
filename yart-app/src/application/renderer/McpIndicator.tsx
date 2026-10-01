import { type JSX } from 'react';
import { t } from '@/common/model/i18n';
import { type McpStatus } from '@/features/mcp';

/** MCP-serverns status i statusraden: en fyrkant och porten den lyssnar på. */
export function McpIndicator({ status }: { status: McpStatus | null }): JSX.Element {
  const port = status?.url ? new URL(status.url).port : null;
  const state = port ? 'is-listening' : status?.error ? 'is-failed' : '';
  const title = port
    ? t('app.mcpListening', { url: status?.url ?? '' })
    : (status?.error ?? t('app.mcpStarting'));
  return (
    <span className={`shell__mcp ${state}`} title={title}>
      <span className="shell__mcp-dot" />
      {port ? t('app.mcpPort', { port }) : t('app.mcp')}
    </span>
  );
}
