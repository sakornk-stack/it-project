import type { ReactNode } from 'react';
import { PEOPLE_SORT_LABELS, type PeopleSort } from '@/lib/student-directory';
import { ACCENT_TONE_CLASSES, type SemanticTone } from '@/lib/tone';
import { cn } from '@/lib/utils';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { CARD } from './instructor-ui';

// The student card shared by /instructor/students and the course page's students
// tab: one frame (thin left accent when the grade needs a look), one identity
// block, one grid. What sits inside the clickable area differs per page.

export const STUDENT_CARD_MAIN =
  'flex min-h-11 flex-1 items-center gap-3 rounded-xl p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2';

export function StudentCardGrid({
  compact = false,
  children,
}: Readonly<{ compact?: boolean; children: ReactNode }>) {
  return (
    <ul className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', !compact && 'xl:grid-cols-3')}>
      {children}
    </ul>
  );
}

export function StudentCardFrame({
  accent,
  accentNote,
  selected = false,
  interactive = true,
  children,
}: Readonly<{
  accent: SemanticTone | null;
  accentNote?: string;
  selected?: boolean;
  interactive?: boolean;
  children: ReactNode;
}>) {
  return (
    <div
      title={accent ? accentNote : undefined}
      className={cn(
        CARD,
        'relative flex h-full flex-col text-card-foreground',
        interactive && 'interactive-card',
        accent && ['border-l-4', ACCENT_TONE_CLASSES[accent]],
        selected && 'bg-brand-light ring-1 ring-brand',
      )}
    >
      {children}
    </div>
  );
}

export function StudentIdentity({
  name,
  code,
  meta,
}: Readonly<{ name: string; code: string; meta?: string }>) {
  return (
    <>
      <InitialsAvatar name={name} />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block truncate font-semibold text-primary" title={name}>
          {name}
        </span>
        <span className="block truncate font-mono text-xs text-muted-foreground">{code}</span>
        {meta && (
          <span className="block truncate text-xs text-muted-foreground" title={meta}>
            {meta}
          </span>
        )}
      </span>
    </>
  );
}

export function StudentListStatus({
  shown,
  total,
  sort,
}: Readonly<{ shown: number; total: number; sort: PeopleSort }>) {
  return (
    <p role="status" aria-live="polite" className="-mt-2 text-xs text-muted-foreground">
      แสดง {shown} จาก {total} คน · เรียงตาม {PEOPLE_SORT_LABELS[sort]}
    </p>
  );
}
