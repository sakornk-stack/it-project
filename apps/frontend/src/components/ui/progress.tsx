'use client';

import { useEffect, useState } from 'react';
import { useInView } from '@/lib/use-in-view';
import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number; // 0-100
  label?: string;
  className?: string;
  barClassName?: string;
  // Hold the bar at 0 until it first scrolls into view, then fill it once. Off by default,
  // where the bar fills right after mount as before.
  animateOnView?: boolean;
}

export function Progress({
  value,
  label,
  className,
  barClassName,
  animateOnView = false,
}: Readonly<ProgressProps>) {
  const clamped = Math.max(0, Math.min(100, value));
  // First paint at 0 so the width transition has somewhere to fill from.
  // Callers that already animate `value` themselves pass `transition-none`.
  const [mounted, setMounted] = useState(false);
  const { ref, seen } = useInView<HTMLDivElement>();
  const filled = animateOnView ? seen : mounted;
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}
    >
      <div
        className={cn('h-full rounded-full bg-primary transition-[width] duration-700 ease-out', barClassName)}
        style={{ width: `${filled ? clamped : 0}%` }}
      />
    </div>
  );
}
