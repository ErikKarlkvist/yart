import { type JSX } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './markdown.css';

/**
 * Rubrikerna hamnar under vyns egen rubrik, så # och ## blir h3 och djupare h4.
 * Länkar öppnas i webbläsaren: target _blank går via fönstrets openhandler i main.
 * Rå HTML i texten visas som text, aldrig som element.
 */
const COMPONENTS: Components = {
  h1: ({ children }) => <h3>{children}</h3>,
  h2: ({ children }) => <h3>{children}</h3>,
  h3: ({ children }) => <h4>{children}</h4>,
  h4: ({ children }) => <h4>{children}</h4>,
  h5: ({ children }) => <h4>{children}</h4>,
  h6: ({ children }) => <h4>{children}</h4>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" title={href}>
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="markdown__table">
      <table>{children}</table>
    </div>
  ),
};

/** Markdown i dokument, reviewer och agentens svar: GFM med länkar, tabeller och kodblock. */
export function Markdown({ text, className }: { text: string; className?: string }): JSX.Element {
  return (
    <div className={className ? `markdown ${className}` : 'markdown'}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
