import { type ReactNode } from 'react';

/** En panel som kan ligga i valfri docka. Appen bestämmer vilka som finns. */
export interface DockPanel {
  id: string;
  /** Flikens text */
  title: string;
  /**
   * false när panelen saknar innehåll just nu, t.ex. Kod utan valt steg. Fliken
   * syns men går inte att välja, och dockan visar första panel som har innehåll.
   */
  available?: boolean;
  /** Panelen fyller dockan och sköter egen scroll och egna marginaler */
  fill?: boolean;
  content: ReactNode;
}
