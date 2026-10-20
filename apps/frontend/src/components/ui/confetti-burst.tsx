'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

const COLORS = ['bg-brand', 'bg-amber-400', 'bg-emerald-500', 'bg-sky-400', 'bg-rose-400'];
const MAX_STAGGER_MS = 150;

const VARIANTS = {
  // Bursts from the centre of the nearest positioned ancestor (a card).
  card: { count: 24, durationMs: 1400, spread: [-120, 120], rise: [-110, -40], fall: null, unit: 'px' },
  // Bursts from the centre of the viewport and rains down the whole screen.
  viewport: { count: 56, durationMs: 2400, spread: [-48, 48], rise: [-55, -15], fall: 75, unit: 'vw' },
} as const;

function between(min: number, max: number) {
  // Visual jitter only, not security-relevant: Math.random is fine here (Sonar S2245).
  return min + Math.random() * (max - min);
}

// Pure-CSS burst. Each piece gets its own --x/--y/--r, read by the `confetti`
// keyframe in tailwind.config.ts. Unmounts itself once the last piece has
// landed. The default `card` variant is bound to the nearest positioned
// ancestor; `viewport` is fixed and must be rendered outside any transformed
// ancestor (use a portal) or the browser will anchor it to that ancestor.
export function ConfettiBurst({
  delayMs = 0,
  variant = 'card',
}: Readonly<{ delayMs?: number; variant?: keyof typeof VARIANTS }>) {
  const cfg = VARIANTS[variant];
  const [pieces] = useState(() =>
    Array.from({ length: cfg.count }, (_, i) => {
      const isViewport = variant === 'viewport';
      return {
        id: i,
        color: COLORS[i % COLORS.length],
        style: {
          '--x': `${between(cfg.spread[0], cfg.spread[1])}${cfg.unit}`,
          '--y': `${between(cfg.rise[0], cfg.rise[1])}${isViewport ? 'vh' : 'px'}`,
          '--r': `${between(-540, 540)}deg`,
          ...(isViewport ? { '--fall': `${cfg.fall}vh`, animationDuration: `${cfg.durationMs}ms` } : {}),
          animationDelay: `${delayMs + between(0, MAX_STAGGER_MS)}ms`,
        } as CSSProperties,
      };
    }),
  );
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDone(true), delayMs + MAX_STAGGER_MS + cfg.durationMs);
    return () => clearTimeout(timer);
  }, [delayMs, cfg.durationMs]);

  if (done) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none inset-0',
        variant === 'viewport' ? 'fixed z-[60] overflow-hidden' : 'absolute z-10',
      )}
    >
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className={cn(
            'absolute left-1/2 top-1/2 animate-confetti rounded-[1px]',
            variant === 'viewport' ? 'h-3 w-2' : 'h-2 w-1.5',
            piece.color,
          )}
          style={piece.style}
        />
      ))}
    </div>
  );
}
