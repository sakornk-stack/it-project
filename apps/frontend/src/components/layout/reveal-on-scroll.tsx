'use client';

import type { ReactNode } from 'react';
import { ScrollReveal } from './reveal';

// A block below the fold that plays when scrolled to. Inside DashboardShell a
// plain Reveal does the same, so this is kept for call sites that already use it.
export function RevealOnScroll({
  className,
  children,
}: Readonly<{ className?: string; children: ReactNode }>) {
  return <ScrollReveal className={className}>{children}</ScrollReveal>;
}
