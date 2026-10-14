'use client';

import { ArrowUpDown, ChevronUp } from 'lucide-react';
import type { SortControl } from '@/lib/use-table-sort';
import { cn } from '@/lib/utils';

// Drop-in replacement for a plain <th> in this codebase's table markup —
// same base classes, so a sortable column sits flush with static ones.
// Pass className="pr-0" for the last column, matching the existing
// convention (cn runs twMerge, so it overrides pr-4 cleanly).
export function SortHeader({
  active,
  direction,
  onToggle,
  className,
  children,
}: SortControl & {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <th
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('py-2 pr-4 font-medium', className)}
    >
      <button
        type="button"
        onClick={onToggle}
        className="group inline-flex items-center gap-1 transition-colors duration-150 hover:text-primary"
      >
        {children}
        {active ? (
          <ChevronUp
            size={14}
            className={cn('text-primary transition-transform', direction === 'desc' && 'rotate-180')}
          />
        ) : (
          <ArrowUpDown
            size={12}
            className="text-slate-400 transition-colors duration-150 group-hover:text-primary"
          />
        )}
      </button>
    </th>
  );
}
