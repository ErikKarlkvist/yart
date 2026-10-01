import { type JSX } from 'react';
import { Icon, type IconName } from './Icon';

export interface CycleOption<T extends string> {
  value: T;
  icon: IconName;
  label: string;
}

interface Props<T extends string> {
  options: readonly CycleOption<T>[];
  value: T;
  onChange: (next: T) => void;
  /** Rubrik i tooltipen, t.ex. "Theme" */
  title: string;
}

/**
 * En ikonknapp som stegar genom ett fast antal val. Ikonen visar det
 * aktuella valet, tooltipen säger vad ett klick byter till.
 */
export function IconCycle<T extends string>({
  options,
  value,
  onChange,
  title,
}: Props<T>): JSX.Element | null {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const current = options[index];
  const next = options[(index + 1) % options.length];
  if (!current || !next) return null;
  const tooltip = `${title}: ${current.label} → ${next.label}`;
  return (
    <button
      type="button"
      className="icon-button icon-button--quiet"
      title={tooltip}
      aria-label={tooltip}
      onClick={() => {
        onChange(next.value);
      }}
    >
      <Icon name={current.icon} size="sm" />
    </button>
  );
}
