import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// One figure, what it counts, and one line saying what it is counted over.
// The figure row has a fixed height and the note sits at the bottom, so cards
// side by side line up whether or not they carry a ring or a footer.
export function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  note,
  visual,
  footer,
  href,
  hrefLabel = 'ดูรายชื่อ',
}: Readonly<{
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  unit?: string;
  note: ReactNode;
  // Optional ring beside the figure; the figure and the note stay as text.
  visual?: ReactNode;
  // Optional block under the figure, e.g. a scale; sits above the note.
  footer?: ReactNode;
  // Only a card that really goes somewhere gets the hover lift and the arrow.
  href?: string;
  hrefLabel?: string;
}>) {
  return (
    <Card className={cn('relative flex h-full flex-col gap-2 p-5', href && 'interactive-card')}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 break-words text-sm font-medium text-muted-foreground">{label}</p>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-light">
          <Icon aria-hidden="true" size={18} className="text-brand" />
        </span>
      </div>
      <div className="flex min-h-16 items-center justify-between gap-3">
        <p className="break-words text-3xl font-bold tabular-nums text-primary">
          {value}
          {unit && (
            <span className="ml-1.5 text-base font-medium text-muted-foreground">{unit}</span>
          )}
        </p>
        {visual}
      </div>
      {footer}
      <div className="mt-auto flex items-end justify-between gap-3">
        <p className="break-words text-sm text-muted-foreground">{note}</p>
        {href && (
          <Link
            href={href}
            className="group/go inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary outline-none after:absolute after:inset-0 after:content-['']"
          >
            {hrefLabel}
            <ArrowRight aria-hidden="true" className="go-arrow h-4 w-4" />
          </Link>
        )}
      </div>
    </Card>
  );
}
