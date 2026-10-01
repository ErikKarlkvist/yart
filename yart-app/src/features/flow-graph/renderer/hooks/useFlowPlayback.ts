import { useCallback, useEffect, useState } from 'react';
import { clampStep } from '../../model/playback';

export interface Playback {
  stepIndex: number;
  playing: boolean;
  atEnd: boolean;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  restart: () => void;
  goTo: (index: number) => void;
}

/**
 * Indexet lagras rått och klampas vid läsning, så antalet steg kan ändras
 * (t.ex. när grafens nivå byts) utan att positionen går förlorad.
 */
export function useFlowPlayback(stepCount: number, intervalMs = 5000): Playback {
  const [rawIndex, setRawIndex] = useState(0);
  const [wantsPlay, setWantsPlay] = useState(false);

  const stepIndex = clampStep(rawIndex, stepCount);
  const atEnd = stepIndex >= stepCount - 1;
  const playing = wantsPlay && !atEnd;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setRawIndex((i) => clampStep(i + 1, stepCount));
    }, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [playing, stepCount, intervalMs]);

  const goTo = useCallback((index: number) => {
    setRawIndex(Math.max(0, index));
  }, []);

  const toggle = useCallback(() => {
    if (atEnd) {
      setRawIndex(clampStep(0, stepCount));
      setWantsPlay(true);
    } else {
      setWantsPlay((p) => !p);
    }
  }, [atEnd, stepCount]);

  const next = useCallback(() => {
    setWantsPlay(false);
    setRawIndex((i) => clampStep(i + 1, stepCount));
  }, [stepCount]);

  const prev = useCallback(() => {
    setWantsPlay(false);
    setRawIndex((i) => clampStep(i - 1, stepCount));
  }, [stepCount]);

  const restart = useCallback(() => {
    setWantsPlay(false);
    setRawIndex(clampStep(0, stepCount));
  }, [stepCount]);

  return { stepIndex, playing, atEnd, toggle, next, prev, restart, goTo };
}
