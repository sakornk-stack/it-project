import * as React from 'react';
import { cn } from '@/lib/utils';

// The one table in the app. The look (grey header, thin row dividers, hover, cell padding)
// lives in `.data-table` in globals.css; this only adds the box around it. Write plain
// <thead>/<th>/<td> inside; give figure columns the class `data-num` (right-aligned, tabular
// digits) and long text the class `data-truncate` plus a title.
//
// A table wider than its box scrolls sideways inside the box. The box is `relative` so
// absolutely positioned text inside a cell (an sr-only label) stays in it instead of
// widening the page on a phone. `scroll={false}` is for a
// table whose header must stay stuck to the page (`sticky`): a scroll box would take that over.
export function DataTable({
  className,
  wrapperClassName,
  scroll = true,
  bordered = true,
  compact = false,
  sticky = false,
  flush = false,
  children,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & {
  wrapperClassName?: string;
  scroll?: boolean;
  // Off when the table already sits flush inside a bordered container.
  bordered?: boolean;
  compact?: boolean;
  sticky?: boolean;
  // First and last cells use the card's 1.5rem padding, for a table that runs edge to edge.
  flush?: boolean;
}) {
  return (
    <div
      className={cn(
        'max-w-full',
        scroll && 'relative overflow-x-auto',
        bordered && 'rounded-lg border border-border',
        wrapperClassName,
      )}
    >
      <table
        className={cn(
          'data-table',
          compact && 'data-table-compact',
          sticky && 'data-table-sticky',
          flush && 'data-table-flush',
          className,
        )}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}
