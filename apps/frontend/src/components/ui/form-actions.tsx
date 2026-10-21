import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// The button row at the foot of every form, sheet and dialog: the main action first (left),
// the secondary one (ยกเลิก) next to it. On a phone they stack, main on top, full width.
export function FormActions({
  className,
  children,
}: Readonly<{ className?: string; children: ReactNode }>) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 pt-2 sm:flex-row sm:items-center [&>button]:w-full sm:[&>button]:w-auto',
        className,
      )}
    >
      {children}
    </div>
  );
}

// The block that holds a delete action at the very end of an edit sheet, apart from the form so
// it is never next to the save button. The red box is the only place the sheet uses red.
export function DangerZone({
  id,
  title,
  description,
  children,
}: Readonly<{ id: string; title: string; description: ReactNode; children: ReactNode }>) {
  return (
    <section
      aria-labelledby={id}
      className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
    >
      <h3 id={id} className="text-sm font-semibold text-destructive">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}
