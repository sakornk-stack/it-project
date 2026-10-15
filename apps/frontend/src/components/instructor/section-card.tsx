'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, Info, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DetailSectionHeader } from '@/components/admin/detail-section-header';
import { CARD } from './instructor-ui';

const BODY_PAD = 'px-4 pb-4 sm:px-6 sm:pb-6';

// The one card every section of the course page uses, on every tab: icon tile,
// title and a short line on the left, a reference on the right. Sections sit
// side by side at the same level; a card never holds another card. `flush`
// drops the body padding for a table that runs edge to edge.
export function SectionCard({
  icon,
  title,
  description,
  aside,
  footer,
  flush = false,
  className,
  children,
}: Readonly<{
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}>) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn(CARD, className)}>
      <DetailSectionHeader
        headingId={headingId}
        icon={icon}
        title={title}
        description={description}
        action={aside && <div className="shrink-0 text-xs text-muted-foreground">{aside}</div>}
      />
      <div className={cn(!flush && BODY_PAD, !flush && 'space-y-4')}>{children}</div>
      {footer && (
        <div className="flex items-start gap-2 rounded-b-xl border-t bg-slate-50 px-4 py-3 text-xs text-muted-foreground sm:px-6">
          <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          <div className="space-y-1">{footer}</div>
        </div>
      )}
    </section>
  );
}

// A SectionCard that folds. One card: the header bar is the toggle, the content
// sits inside the same frame and is never repeated under a second heading. The
// height animates through a grid-row track (no measuring, no library); folded
// content is `invisible`, so it leaves the tab order and the reading order.
export function CollapsibleCard({
  icon: Icon,
  title,
  description,
  defaultOpen = false,
  className,
  children,
}: Readonly<{
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}>) {
  const [open, setOpen] = useState(defaultOpen);
  const baseId = useId();
  const buttonId = `${baseId}-button`;
  const regionId = `${baseId}-region`;
  return (
    <section className={cn(CARD, className)}>
      <h2>
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={regionId}
          onClick={() => setOpen((v) => !v)}
          className="interactive-row flex min-h-11 w-full items-start gap-3 rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:p-6"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand"
          >
            <Icon size={18} />
          </span>
          <span className="min-w-0 flex-1 space-y-1">
            <span className="course-name-break block text-base font-semibold leading-tight text-primary">
              {title}
            </span>
            {description && (
              <span className="course-name-break block text-sm font-normal text-muted-foreground">
                {description}
              </span>
            )}
          </span>
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={cn(
              'mt-2 shrink-0 text-muted-foreground transition-transform duration-300 ease-out motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
        </button>
      </h2>
      <div
        id={regionId}
        role="region"
        aria-labelledby={buttonId}
        className={cn(
          'grid transition-[grid-template-rows,visibility] duration-300 ease-out motion-reduce:transition-none',
          open ? 'visible grid-rows-[1fr]' : 'invisible grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-4 border-t px-4 py-4 sm:px-6 sm:pb-6">{children}</div>
        </div>
      </div>
    </section>
  );
}
