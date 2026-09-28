import { type IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBackwardStep,
  faBolt,
  faChevronDown,
  faChevronRight,
  faChevronUp,
  faCircleExclamation,
  faCircleHalfStroke,
  faCircleInfo,
  faCommentDots,
  faCopy,
  faCloud,
  faCode,
  faCodeBranch,
  faDatabase,
  faDesktop,
  faFolderOpen,
  faForwardStep,
  faGears,
  faKey,
  faLink,
  faMoon,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
  faLayerGroup,
  faPause,
  faPlay,
  faPlus,
  faRotateLeft,
  faRoute,
  faServer,
  faSun,
  faTriangleExclamation,
  faWindowMaximize,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { type JSX } from 'react';

/** Ikonerna appen använder. Lägg till här i stället för att importera Font Awesome direkt. */
const ICONS = {
  chevronDown: faChevronDown,
  chevronUp: faChevronUp,
  play: faPlay,
  plus: faPlus,
  pause: faPause,
  stepBack: faBackwardStep,
  stepForward: faForwardStep,
  restart: faRotateLeft,
  close: faXmark,
  chevronRight: faChevronRight,
  // Nod- och systemtyper i grafen
  app: faDesktop,
  api: faServer,
  ui: faWindowMaximize,
  handler: faCode,
  http: faRoute,
  service: faGears,
  db: faDatabase,
  cache: faBolt,
  external: faCloud,
  queue: faLayerGroup,
  key: faKey,
  branch: faCodeBranch,
  folder: faFolderOpen,
  themeSystem: faCircleHalfStroke,
  themeLight: faSun,
  themeDark: faMoon,
  chat: faCommentDots,
  copy: faCopy,
  error: faCircleExclamation,
  warning: faTriangleExclamation,
  info: faCircleInfo,
  link: faLink,
  zoomIn: faMagnifyingGlassPlus,
  zoomOut: faMagnifyingGlassMinus,
} satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  size?: 'sm' | 'md' | 'lg';
}

/** Ikoner är dekorativa. Knappen som håller ikonen bär betydelsen via text eller aria-label. */
export function Icon({ name, size = 'md' }: Props): JSX.Element {
  return <FontAwesomeIcon icon={ICONS[name]} className={`icon icon--${size}`} aria-hidden />;
}
