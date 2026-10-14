import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

// The header every card on the user detail page shares: a brand-tinted icon
// tile, the section title, a line saying what it is for, and an optional action
// on the right (it wraps under the text on a narrow screen).
export function DetailSectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: Readonly<{ icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode }>) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3 sm:p-6 sm:pb-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand"
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0 space-y-1">
          <h2 className="course-name-break text-base font-semibold leading-tight text-primary">
            {title}
          </h2>
          {description && (
            <p className="course-name-break text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
