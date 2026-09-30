import { type JSX } from 'react';
import { t } from '@/common/model/i18n';
import { type CycleOption, IconCycle } from '@/common/renderer/IconCycle';
import { THEME_LABELS, type ThemePreference, useTheme } from './theme';

const OPTIONS: readonly CycleOption<ThemePreference>[] = [
  { value: 'system', icon: 'themeSystem', label: THEME_LABELS.system },
  { value: 'light', icon: 'themeLight', label: THEME_LABELS.light },
  { value: 'dark', icon: 'themeDark', label: THEME_LABELS.dark },
];

/** Temaknappen i fönsterraden: en ikon som stegar system, ljust, mörkt. */
export function ThemeSelect(): JSX.Element {
  const [preference, setPreference] = useTheme();
  return (
    <IconCycle
      options={OPTIONS}
      value={preference}
      onChange={setPreference}
      title={t('theme.label')}
    />
  );
}
