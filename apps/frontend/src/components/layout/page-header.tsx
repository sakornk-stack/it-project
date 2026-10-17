import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// The one page-title size for every role (28px, the size the instructor pages settled on).
// Pages never set it themselves; `titleClassName` is for non-size tweaks like line breaking.
export const PAGE_TITLE_CLASS = 'text-[28px] font-semibold leading-tight text-primary';

export function PageHeader({
  title,
  description,
  actions,
  className,
  titleClassName,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="min-w-0 space-y-1">
        <h1 className={cn(PAGE_TITLE_CLASS, titleClassName)}>{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
