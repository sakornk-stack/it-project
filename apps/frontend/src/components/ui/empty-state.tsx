import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EMPTY_STATE_ILLUSTRATIONS, type EmptyStateIllustration } from './empty-state-illustrations';

const ILLUSTRATION_SIZE = { sm: 72, md: 96 } as const;

type EmptyStateVisual =
  | { icon: LucideIcon; illustration?: never; size?: never }
  | { illustration: EmptyStateIllustration; icon?: never; size?: keyof typeof ILLUSTRATION_SIZE };

// Centered block variant — matches the pattern previously duplicated in
// plo-radar-chart.tsx / course-insight-card.tsx (icon size 28, muted slate).
// Pass `icon` for the compact Lucide look or `illustration` for the line-art
// drawings; exactly one of the two.
export function EmptyState({
  description,
  action,
  className,
  ...visual
}: {
  description: ReactNode;
  action?: ReactNode;
  className?: string;
} & EmptyStateVisual) {
  if (visual.illustration) {
    const Illustration = EMPTY_STATE_ILLUSTRATIONS[visual.illustration];
    return (
      <div className={cn('flex flex-col items-center gap-3 py-8 text-center', className)}>
        <Illustration size={ILLUSTRATION_SIZE[visual.size ?? 'md']} />
        <p className="text-muted-foreground">{description}</p>
        {action}
      </div>
    );
  }

  const Icon = visual.icon;
  return (
    <div className={cn('flex flex-col items-center gap-2 py-8 text-center', className)}>
      <Icon size={28} className="text-slate-300" aria-hidden="true" />
      <p className="text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

// Dashed-border row variant — matches the pattern previously duplicated in
// elective-category-list.tsx (icon + paragraph side by side).
export function InlineNotice({
  icon: Icon,
  children,
  className,
  solid = false,
}: {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
  // Neutral solid border instead of the dashed one.
  solid?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-muted-foreground',
        !solid && 'border-dashed',
        className,
      )}
    >
      <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
