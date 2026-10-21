import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// The one page-title size for every role (28px, the size the instructor pages settled on).
// Pages never set it themselves; `titleClassName` is for non-size tweaks like line breaking.
export const PAGE_TITLE_CLASS =
  'text-[1.75rem] font-semibold leading-[1.4] tracking-tight text-primary';

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
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between',
        className,
      )}
    >
      {/* The title keeps room for one line; a wide action group drops below it instead of squeezing it. */}
      <div className="min-w-0 space-y-1.5 sm:flex-1 sm:basis-[26rem]">
        <h1 className={cn(PAGE_TITLE_CLASS, titleClassName)}>{title}</h1>
        {description && <p className="course-name-break text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="max-w-full shrink-0">{actions}</div>}
    </div>
  );
}
