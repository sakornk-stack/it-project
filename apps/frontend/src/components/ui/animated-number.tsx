'use client';

import { COUNT_UP_MS, numberText } from '@/lib/animated-number';
import { useCountOnce } from '@/lib/use-count-once';
import { useInView } from '@/lib/use-in-view';
import { useCountUpAllowed } from './count-up-policy';

// A figure that counts up once when it first appears. After that, and for a
// missing value, it is plain text. Under reduced motion it is the final value
// from the first paint. A screen reader gets the final value only.
export function AnimatedNumber({
  value,
  format = String,
  decimals = 0,
  fallback = '—',
  duration = COUNT_UP_MS,
}: Readonly<{
  value: number | null | undefined;
  format?: (n: number) => string;
  decimals?: number;
  fallback?: string;
  duration?: number;
}>) {
  const enabled = useCountUpAllowed();
  const { ref, seen } = useInView<HTMLSpanElement>();
  const current = useCountOnce(value, { duration, decimals, enabled, waiting: !seen });
  const { final, shown } = numberText(value, current ?? 0, format, fallback);

  if (final === shown && seen) return <span ref={ref}>{final}</span>;
  return (
    <span ref={ref}>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{final}</span>
    </span>
  );
}
