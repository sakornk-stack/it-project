import Link from 'next/link';
import { ArrowDown, ArrowRight, Check, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BADGE_TONE_CLASSES, type SemanticTone } from '@/lib/tone';

// What the figure means: tints the icon tile and the number. 'primary' is the
// brand look; the SemanticTone values follow the shared tone palette.
export type StatCardTone = 'primary' | SemanticTone;

const TONE_ICON_TILE: Record<StatCardTone, string> = {
  primary: 'bg-brand-light text-brand',
  success: BADGE_TONE_CLASSES.success,
  warning: BADGE_TONE_CLASSES.warning,
  danger: BADGE_TONE_CLASSES.danger,
  neutral: BADGE_TONE_CLASSES.neutral,
};
// The `large` tile: the same hues as above with a soft diagonal fade.
const TONE_ICON_GRADIENT: Record<StatCardTone, string> = {
  primary: 'bg-gradient-to-br from-brand-light to-sky-100 text-brand',
  success: 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700',
  warning: 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-700',
  danger: 'bg-gradient-to-br from-red-50 to-red-100 text-red-700',
  neutral: 'bg-gradient-to-br from-slate-50 to-slate-200 text-slate-600',
};
const TONE_VALUE: Record<StatCardTone, string> = {
  primary: 'text-primary',
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-red-700',
  neutral: 'text-primary',
};

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
  // An action instead of a destination (e.g. scroll to a section): the card becomes a button.
  // Takes the same `showArrow` and `ariaLabel` as `href`, with a down arrow.
  onClick?: () => void;
  // Shorter card for dense pages: less padding, smaller figure.
  compact?: boolean;
  // Shortest card: icon and label share one row, figure below. For summary rows of 3-4 cards.
  dense?: boolean;
  tone?: StatCardTone;
  // false = no lift on hover, for a card that goes nowhere.
  interactive?: boolean;
  // Small line under the figure, for what the unit or the figure refers to.
  caption?: string;
  // Makes the card a toggle button (a filter): `selected` is its pressed state.
  onSelect?: () => void;
  selected?: boolean;
  // Softer look for a figure of zero; a toggle stays pressable.
  dimmed?: boolean;
  // Bigger gradient icon tile and a smaller unit beside the figure; the figure stays
  // in the heading colour whatever the tone.
  large?: boolean;
  // With `href`: the whole card is the link and lifts on hover (interactive-card), with a
  // "go" arrow that appears on hover/focus. `ariaLabel` names the destination and the figure.
  showArrow?: boolean;
  ariaLabel?: string;
  // Colour of a thin strip down the card's left edge (e.g. a role accent).
  accentClassName?: string;
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
  onClick,
  compact = false,
  dense = false,
  tone,
  interactive = true,
  caption,
  onSelect,
  selected = false,
  dimmed = false,
  large = false,
  showArrow = false,
  ariaLabel,
  accentClassName,
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
  // Seen only on a pressed toggle, so the state is not carried by the ring colour alone.
  const selectedMark = onSelect && selected && (
    <Check size={16} aria-hidden="true" className="text-brand" />
  );
  const asLink = (!!href || !!onClick) && !onSelect;
  const GoIcon = onClick && !href ? ArrowDown : ArrowRight;
  const linkArrow = asLink && showArrow && (
    <GoIcon size={18} aria-hidden="true" className="go-arrow text-brand" />
  );
  const heading = dense ? (
    <div className="mb-1 flex items-center gap-2">
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
          tone ? TONE_ICON_TILE[tone] : 'bg-brand-light text-brand',
        )}
      >
        <Icon size={14} className={tone ? undefined : 'text-brand'} />
      </div>
      <p className="min-w-0 text-sm text-muted-foreground">{label}</p>
      {(badgeNode || selectedMark || linkArrow) && (
        <span className="ml-auto">{badgeNode ?? selectedMark ?? linkArrow}</span>
      )}
    </div>
  ) : (
    <>
      <div className={cn(compact ? 'mb-2' : 'mb-3', 'flex items-start justify-between')}>
        <div
          className={cn(
            'flex items-center justify-center',
            large ? 'h-12 w-12 rounded-xl' : 'h-9 w-9 rounded-lg',
            large
              ? TONE_ICON_GRADIENT[tone ?? 'primary']
              : tone
                ? TONE_ICON_TILE[tone]
                : 'bg-brand-light text-brand',
          )}
        >
          <Icon
            size={large ? 24 : 18}
            aria-hidden="true"
            className={tone || large ? undefined : 'text-brand'}
          />
        </div>
        {badgeNode ?? selectedMark}
        {linkArrow}
      </div>
      <p className="mb-1 text-sm text-muted-foreground">{label}</p>
    </>
  );

  const card = (
    <Card
      className={cn(
        'h-full',
        asLink && showArrow && 'border-0 bg-transparent shadow-none',
        accentClassName && 'relative overflow-hidden',
        selected && 'border-brand',
        dimmed && 'opacity-75',
        interactive &&
          !(asLink && showArrow) &&
          'transition-[transform,box-shadow] duration-200 ease-out md:hover:-translate-y-0.5 md:hover:shadow-md',
      )}
    >
      {accentClassName && (
        <span
          aria-hidden="true"
          className={cn('absolute inset-y-0 left-0 w-1', accentClassName)}
        />
      )}
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
                'font-semibold',
                tone && !large ? TONE_VALUE[tone] : 'text-primary',
              )}
            >
              {value}
              {suffix && (
                <span
                  className={cn(
                    'ml-1 font-normal text-muted-foreground',
                    large ? 'text-sm' : 'text-base',
                  )}
                >
                  {suffix}
                </span>
              )}
            </p>
            {caption && <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>}
          </>
        )}
        {footer && <div className="mt-3">{footer}</div>}
      </CardContent>
    </Card>
  );

  if (onSelect) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        title={selected ? 'กดอีกครั้งเพื่อล้างตัวกรอง' : 'กดเพื่อกรองรายการตามสถานะนี้'}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          'block h-full cursor-pointer rounded-xl outline-none ring-offset-background transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 motion-reduce:transition-none',
          selected && 'ring-2 ring-brand',
        )}
      >
        {card}
      </div>
    );
  }
  const linkLook = cn(
    'block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
    // The link is the visible card here, so the hover border and lift belong to it.
    showArrow
      ? 'interactive-card rounded-lg border bg-card text-card-foreground shadow-sm'
      : 'rounded-xl',
  );
  if (onClick && !href) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={cn(linkLook, 'w-full text-left')}
      >
        {card}
      </button>
    );
  }
  if (!href) return card;
  return (
    <Link href={href} aria-label={ariaLabel} className={linkLook}>
      {card}
    </Link>
  );
}
