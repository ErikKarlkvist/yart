import { type JSX } from 'react';
import { type InlinePart, parseMarkdown } from '@/common/model/markdown';

/** Rubriknivåerna i texten under dokumentets egen rubrik */
const HEADINGS = { 1: 'h3', 2: 'h3', 3: 'h4' } as const;

/** Läsbar text i den lilla markdown dokument och reviewer skrivs i. */
export function Markdown({ text, className }: { text: string; className?: string }): JSX.Element {
  return (
    <div className={className ? `markdown ${className}` : 'markdown'}>
      {parseMarkdown(text).map((block, index) => {
        switch (block.kind) {
          case 'heading': {
            const Tag = HEADINGS[block.level];
            return (
              <Tag key={index}>
                <Inline parts={block.content} />
              </Tag>
            );
          }
          case 'paragraph':
            return (
              <p key={index}>
                <Inline parts={block.content} />
              </p>
            );
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul';
            return (
              <Tag key={index}>
                {block.items.map((item, i) => (
                  <li key={i}>
                    <Inline parts={item} />
                  </li>
                ))}
              </Tag>
            );
          }
        }
      })}
    </div>
  );
}

function Inline({ parts }: { parts: InlinePart[] }): JSX.Element {
  return (
    <>
      {parts.map((part, i) =>
        part.kind === 'strong' ? (
          <strong key={i}>{part.text}</strong>
        ) : part.kind === 'code' ? (
          <code key={i}>{part.text}</code>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
