import { useCallback, useEffect, useState } from 'react';
import { t } from '@/common/model/i18n';
import { titleBarThemeChannel } from '@/application/ipc/channels';
import { invokeChannel } from '@/common/renderer/ipc';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'yart.theme';
const PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

function isPreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (PREFERENCES as readonly string[]).includes(value);
}

function readStored(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Temat styrs av `data-theme` på <html>. Saknas attributet följer CSS:en systemet
 * via prefers-color-scheme, se styles.css.
 */
export function useTheme(): [ThemePreference, (next: ThemePreference) => void] {
  const [preference, setPreference] = useState<ThemePreference>(readStored);

  useEffect(() => {
    const root = document.documentElement;
    if (preference === 'system') delete root.dataset.theme;
    else root.dataset.theme = preference;
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // localStorage kan vara otillgängligt, temat gäller ändå för sessionen
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTitleBar = (): void => {
      void invokeChannel(titleBarThemeChannel, {
        dark: preference === 'dark' || (preference === 'system' && media.matches),
      }).catch(console.error);
    };
    updateTitleBar();
    media.addEventListener('change', updateTitleBar);
    return () => {
      media.removeEventListener('change', updateTitleBar);
    };
  }, [preference]);

  const set = useCallback((next: ThemePreference) => {
    setPreference(next);
  }, []);

  return [preference, set];
}

export const THEME_LABELS: Readonly<Record<ThemePreference, string>> = {
  system: t('theme.system'),
  light: t('theme.light'),
  dark: t('theme.dark'),
};
