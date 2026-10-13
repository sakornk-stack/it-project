'use client';

import type { ReactNode } from 'react';
import { ringTick } from '@/lib/progress-ring-geometry';
import { COUNT_UP_MS } from '@/lib/animated-number';
import { useCountOnce } from '@/lib/use-count-once';
import { useInView } from '@/lib/use-in-view';
import { useCountUpAllowed } from '@/components/ui/count-up-policy';
import { ProgressRing } from '@/components/ui/progress-ring';

// ProgressRing for the non-student pages: the arc fills once, the centre is a
// fixed text the caller supplies, and an optional goal is marked as a tick.
// The ring is decoration. The caller prints the same figures as text next to
// it, so the ring is hidden from screen readers rather than read mid-count.
export function AnimatedRing({
  percent,
  goal,
  tone,
  size = 88,
  strokeWidth = 8,
  children,
}: Readonly<{
  percent: number;
  goal?: number | null;
  tone?: 'default' | 'neutral';
  size?: number;
  strokeWidth?: number;
  children: ReactNode;
}>) {
  const enabled = useCountUpAllowed();
  const { ref, seen } = useInView<HTMLDivElement>();
  const arc =
    useCountOnce(percent, {
      duration: COUNT_UP_MS,
      decimals: 1,
      enabled,
      waiting: !seen,
    }) ?? percent;
  const tick = goal === null || goal === undefined ? null : ringTick(size, strokeWidth, goal);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <ProgressRing value={arc} label="" tone={tone} size={size} strokeWidth={strokeWidth}>
        {children}
      </ProgressRing>
      {tick && (
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="pointer-events-none absolute inset-0"
          focusable="false"
        >
          <line
            x1={tick.from.x}
            y1={tick.from.y}
            x2={tick.to.x}
            y2={tick.to.y}
            strokeWidth={2.5}
            strokeLinecap="round"
            className="stroke-slate-700"
          />
        </svg>
      )}
    </div>
  );
}
