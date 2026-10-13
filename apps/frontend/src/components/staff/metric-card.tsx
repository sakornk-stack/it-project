import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

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
}>) {
  return (
    <Card className="flex h-full flex-col gap-2 p-5">
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
      <p className="mt-auto break-words text-sm text-muted-foreground">{note}</p>
    </Card>
  );
}
