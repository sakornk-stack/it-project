'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BADGE_TONE_CLASSES, BAR_TONE_CLASSES, type SemanticTone } from '@/lib/tone';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ICON_TILE_CLASS, PROFILE_CARD_CLASS } from '@/components/profile/profile-card-class';

// Status chip for a security row: a dot (pulsing only while `live`) plus a text label, so the
// state never relies on colour alone.
export function SecurityStatus({
  tone,
  label,
  live = false,
}: Readonly<{ tone: SemanticTone; label: string; live?: boolean }>) {
  return (
    <Badge tone={tone} className="gap-1.5 whitespace-nowrap">
      <span aria-hidden="true" className="relative flex h-2 w-2">
        {live && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none',
              BAR_TONE_CLASSES[tone],
            )}
          />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', BAR_TONE_CLASSES[tone])} />
      </span>
      {label}
    </Badge>
  );
}

// Opens its content by growing the height (grid 0fr -> 1fr) on mount; reduced motion skips it.
function ExpandPanel({ children }: Readonly<{ children: ReactNode }>) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="mt-5 rounded-xl border bg-muted/30 p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

// One security control as its own card: [icon tile] title + status chip + description, then the
// panel that opens in place, then the action at the foot (full width on a phone). `attention`
// tints only the icon tile.
export function SecurityCard({
  icon: Icon,
  title,
  description,
  status,
  action,
  attention = false,
  className,
  children,
}: Readonly<{
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  attention?: boolean;
  className?: string;
  children?: ReactNode;
}>) {
  return (
    <Card className={cn(PROFILE_CARD_CLASS, 'flex min-w-0 flex-col', className)}>
      <CardContent className="flex flex-1 flex-col p-4 pt-4 sm:p-6 sm:pt-6">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className={cn(
              ICON_TILE_CLASS,
              'h-11 w-11',
              attention && cn(BADGE_TONE_CLASSES.warning, 'border-0 bg-none dark:shadow-none'),
            )}
          >
            <Icon size={20} />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <h3 className="course-name-break text-base font-semibold leading-snug text-primary">
                {title}
              </h3>
              {status}
            </div>
            <p className="course-name-break text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        {children && <ExpandPanel>{children}</ExpandPanel>}
        {action && <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">{action}</div>}
      </CardContent>
    </Card>
  );
}

// Information-only strip under the cards: muted, no action.
export function SecurityNote({
  icon: Icon,
  title,
  description,
  className,
}: Readonly<{ icon: LucideIcon; title: string; description: string; className?: string }>) {
  return (
    <div
      className={cn('flex items-center gap-4 rounded-xl border bg-muted/30 p-4 sm:p-6', className)}
    >
      <span aria-hidden="true" className={cn(ICON_TILE_CLASS, 'h-11 w-11 opacity-60')}>
        <Icon size={20} />
      </span>
      <div className="min-w-0 space-y-1">
        <p className="course-name-break text-sm font-medium leading-snug tabular-nums text-foreground/80">
          {title}
        </p>
        <p className="course-name-break text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
