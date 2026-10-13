import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BADGE_TONE_CLASSES, type SemanticTone } from '@/lib/tone';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value?: React.ReactNode;
  suffix?: string;
  // 'positive' is the original green pill; the SemanticTone values are for a status
  // reading (icon + text, so the meaning never rests on colour alone).
  badge?: { text: string; tone?: 'positive' | SemanticTone; icon?: LucideIcon };
  footer?: React.ReactNode;
  // Replaces the big number: shown to the right of the icon + label (e.g. a
  // progress ring that carries its own centre value). When the card is too
  // narrow for both side by side it drops below the label instead of
  // squeezing the label into the ring.
  visual?: React.ReactNode;
  href?: string;
  // Shorter card for dense pages: less padding, smaller figure.
  compact?: boolean;
  // Shortest card: icon and label share one row, figure below. For summary rows of 3-4 cards.
  dense?: boolean;
}

// Deliberately no percentile/trend badges — the Figma mockup had "Top
// 15%" and "+3% this term" on these cards, but no endpoint anywhere
// computes a peer percentile or a term-over-term delta. `badge` here is
// only ever fed a value derived from real fields (e.g. graduationReadiness
// .creditsMet → "On Track"), never a placeholder number.
export function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  badge,
  footer,
  visual,
  href,
  compact = false,
  dense = false,
}: Readonly<StatCardProps>) {
  const BadgeIcon = badge?.icon;
  // The original pill (no tone, 'positive' or 'neutral', no icon) keeps its exact classes; the
  // bordered status pill is only for a SemanticTone status or when an icon is passed.
  const isStatusBadge =
    !!badge &&
    (BadgeIcon !== undefined ||
      badge.tone === 'success' ||
      badge.tone === 'warning' ||
      badge.tone === 'danger');
  const badgeNode =
    badge &&
    (isStatusBadge ? (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
          badge.tone === 'positive'
            ? BADGE_TONE_CLASSES.success
            : BADGE_TONE_CLASSES[badge.tone ?? 'neutral'],
        )}
      >
        {BadgeIcon && <BadgeIcon size={12} aria-hidden="true" />}
        {badge.text}
      </span>
    ) : (
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-xs font-medium',
          badge.tone === 'positive'
            ? 'bg-emerald-50 text-emerald-600'
            : 'bg-slate-100 text-slate-600',
        )}
      >
        {badge.text}
      </span>
    ));
  const heading = dense ? (
    <div className="mb-1 flex items-center gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-light">
        <Icon size={14} className="text-brand" />
      </div>
      <p className="min-w-0 text-sm text-muted-foreground">{label}</p>
      {badgeNode && <span className="ml-auto">{badgeNode}</span>}
    </div>
  ) : (
    <>
      <div className={cn(compact ? 'mb-2' : 'mb-3', 'flex items-start justify-between')}>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-light">
          <Icon size={18} className="text-brand" />
        </div>
        {badgeNode}
      </div>
      <p className="mb-1 text-sm text-muted-foreground">{label}</p>
    </>
  );

  const card = (
    <Card className="h-full transition-[transform,box-shadow] duration-200 ease-out md:hover:-translate-y-0.5 md:hover:shadow-md">
      <CardContent className={dense ? 'p-3' : compact ? 'p-4' : 'pt-6'}>
        {visual ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[4rem] flex-1">{heading}</div>
            {visual}
          </div>
        ) : (
          <>
            {heading}
            <p
              className={cn(
                compact || dense ? 'text-2xl' : 'text-3xl',
                'font-semibold text-primary',
              )}
            >
              {value}
              {suffix && (
                <span className="ml-1 text-base font-normal text-muted-foreground">{suffix}</span>
              )}
            </p>
          </>
        )}
        {footer && <div className="mt-3">{footer}</div>}
      </CardContent>
    </Card>
  );

  if (!href) return card;
  return (
    <Link
      href={href}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      {card}
    </Link>
  );
}
