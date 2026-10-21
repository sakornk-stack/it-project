import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Native <details>: keyboard and screen-reader toggling for free, no state, no
// library. `framed` makes the whole section one card with the content inside;
// unframed, only the summary bar looks like a card and the content (usually
// cards of its own) stacks below it, so cards are never nested.
export function CollapsibleSection({
  title,
  meta,
  defaultOpen = false,
  framed = true,
  soft = false,
  children,
}: Readonly<{
  title: ReactNode;
  meta?: ReactNode;
  defaultOpen?: boolean;
  framed?: boolean;
  // A light grey bar instead of a card, for an aside such as "how to read this".
  soft?: boolean;
  children: ReactNode;
}>) {
  const card = 'rounded-lg border bg-card text-card-foreground shadow-card';
  if (soft) {
    return (
      <details open={defaultOpen} className="group rounded-lg bg-muted/50">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            {title}
            {meta}
          </span>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <div className="px-3 pb-3">{children}</div>
      </details>
    );
  }
  return (
    <details open={defaultOpen} className={cn('group', framed && card)}>
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-6 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden',
          !framed && card,
        )}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-base font-semibold">
          {title}
          {meta}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className={framed ? 'px-6 pb-6' : 'mt-4 space-y-4'}>{children}</div>
    </details>
  );
}
