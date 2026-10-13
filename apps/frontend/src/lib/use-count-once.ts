import { useEffect, useState, useSyncExternalStore } from 'react';
import { COUNT_UP_MS, isCountable } from './animated-number';
import { useCountUp } from './use-count-up';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

const prefersReducedMotion = () => window.matchMedia(QUERY).matches;

// The value to draw right now: it counts up once, the first time a real
// number arrives, and is the real value from then on. Reduced motion is the
// real value from the first paint.
export function useCountOnce(
  value: number | null | undefined,
  // waiting: hold at 0 (the count has not started) until the caller flips it off, e.g. until
  // the figure has scrolled into view. Reduced motion ignores it and shows the real value.
  options?: { duration?: number; decimals?: number; enabled?: boolean; waiting?: boolean },
): number | null {
  const countable = isCountable(value);
  const enabled = options?.enabled ?? true;
  const waiting = options?.waiting ?? false;
  const reduced = useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
  const counted = useCountUp(countable && enabled && !waiting ? value : 0, {
    duration: options?.duration ?? COUNT_UP_MS,
    decimals: options?.decimals ?? 0,
  });
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (countable && counted === value) setSettled(true);
  }, [countable, counted, value]);

  if (!countable) return null;
  if (reduced || settled || !enabled) return value;
  return waiting ? 0 : counted;
}
