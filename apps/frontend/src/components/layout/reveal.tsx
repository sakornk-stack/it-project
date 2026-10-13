'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { REVEAL_INITIAL_BATCH_MS, revealDelayMs } from '@/lib/reveal';
import { useInView } from '@/lib/use-in-view';
import { cn } from '@/lib/utils';

const ENTRANCE =
  'animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none';

// Inside DashboardShell every Reveal waits until its block is reached before it
// plays; outside it (landing, login, register — server-rendered) it stays a
// plain CSS entrance that plays at mount, so no content is ever hidden before
// hydration.
const RevealOnViewContext = createContext(false);

export function RevealOnViewProvider({ children }: Readonly<{ children: ReactNode }>) {
  return <RevealOnViewContext.Provider value>{children}</RevealOnViewContext.Provider>;
}

// Page-load entrance for top-level blocks. Convention: the page header is
// index 0 (animated or not), content blocks count up from 1.
// animationFillMode 'both' keeps a block hidden until its own delay starts —
// without it every block flashes in at once, then animates.
// Plays once per mounted instance, so a refetch or a filter change never replays
// it. Do not wrap rows of a filtered/paginated list or anything that remounts
// often; pass animate={false} where a block must not move at all.
export function Reveal({
  index = 0,
  className,
  animate = true,
  children,
}: Readonly<{ index?: number; className?: string; animate?: boolean; children: ReactNode }>) {
  const onView = useContext(RevealOnViewContext);
  if (!animate) return <div className={className}>{children}</div>;
  if (onView) {
    return (
      <ScrollReveal index={index} className={className}>
        {children}
      </ScrollReveal>
    );
  }
  return (
    <div
      className={cn(ENTRANCE, className)}
      style={{
        animationDelay: `${revealDelayMs(index, true)}ms`,
        animationFillMode: 'both',
      }}
    >
      {children}
    </div>
  );
}

// Same entrance, started when the block is first reached. First-screen blocks
// keep their index stagger; one scrolled to later plays at once. The pending
// (hidden) state is applied on the first client render, so use it only for
// blocks that mount after client-side data loads.
export function ScrollReveal({
  index = 0,
  className,
  children,
}: Readonly<{ index?: number; className?: string; children: ReactNode }>) {
  const { ref, seen, msToSeen } = useInView<HTMLDivElement>();
  const delay = revealDelayMs(index, msToSeen <= REVEAL_INITIAL_BATCH_MS);

  return (
    <div
      ref={ref}
      className={cn(seen ? ENTRANCE : 'reveal-pending', className)}
      style={{ animationDelay: seen ? `${delay}ms` : undefined, animationFillMode: 'both' }}
    >
      {children}
    </div>
  );
}
