import 'react';

declare module 'react' {
  interface CSSProperties {
    '--sidebar-width'?: string;
    '--bottom-height'?: string;
    '--side-width'?: string;
  }
}
