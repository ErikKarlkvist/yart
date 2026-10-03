import { useCallback, useEffect, useRef, useState } from 'react';

/** Hur länge något förblir hovrat efter att musen lämnat det, i millisekunder */
const LINGER_MS = 200;

/**
 * Hover som dröjer kvar en kort stund efter att musen lämnat elementet. Då
 * hinner musen korsa glappet mellan en etikett och dess popup utan att popupen
 * stängs, och en ny hover avbryter den väntande stängningen.
 */
export function useLingeringHover(): [string | null, (id: string | null) => void] {
  const [hovered, setHovered] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const hover = useCallback(
    (id: string | null) => {
      cancel();
      if (id !== null) {
        setHovered(id);
        return;
      }
      timer.current = setTimeout(() => {
        timer.current = null;
        setHovered(null);
      }, LINGER_MS);
    },
    [cancel],
  );
  useEffect(() => cancel, [cancel]);
  return [hovered, hover];
}
