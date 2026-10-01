import 'react';

declare module 'react' {
  interface CSSProperties {
    '--dock-left'?: string;
    '--dock-right'?: string;
    '--dock-bottom'?: string;
  }
}
