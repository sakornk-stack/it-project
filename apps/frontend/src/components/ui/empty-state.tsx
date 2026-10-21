import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EMPTY_STATE_ILLUSTRATIONS, type EmptyStateIllustration } from './empty-state-illustrations';

const ILLUSTRATION_SIZE = { sm: 72, md: 96 } as const;

type EmptyStateVisual =
  | { icon: LucideIcon; illustration?: never; size?: never }
  | { illustration: EmptyStateIllustration; icon?: never; size?: keyof typeof ILLUSTRATION_SIZE };

// The one look for "nothing here", "could not load" and their kin: a faded icon, a title
// line, a short explanation line and an optional button, centred. Empty lists
// (EmptyState) and a failed page load (PageLoadError) both render through it.
export function StateBlock({
  icon: Icon,
  illustration,
  illustrationSize = 'md',
  tone = 'neutral',
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  illustration?: EmptyStateIllustration;
  illustrationSize?: keyof typeof ILLUSTRATION_SIZE;
  tone?: 'neutral' | 'danger';
  title?: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Illustration = illustration ? EMPTY_STATE_ILLUSTRATIONS[illustration] : null;
  return (
    <div className={cn('flex flex-col items-center gap-3 py-8 text-center', className)}>
      {Illustration ? (
        <Illustration size={ILLUSTRATION_SIZE[illustrationSize]} />
      ) : (
        Icon && (
          <span
            aria-hidden="true"
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full',
              tone === 'danger'
                ? 'bg-destructive/10 text-destructive/70'
                : 'bg-muted text-muted-foreground/70',
            )}
          >
            <Icon size={24} />
          </span>
        )
      )}
      <div className="max-w-md space-y-1">
        {title && <p className="font-medium text-foreground">{title}</p>}
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

// Centered block variant. Pass `icon` for the compact Lucide look or `illustration` for the
// line-art drawings; exactly one of the two. `title` is the first of the two text lines;
// leave it out when one sentence says it all.
export function EmptyState({
  title,
  description,
  action,
  className,
  ...visual
}: {
  title?: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
} & EmptyStateVisual) {
  return (
    <StateBlock
      icon={visual.icon}
      illustration={visual.illustration}
      illustrationSize={visual.size}
      title={title}
      description={description}
      action={action}
      className={className}
    />
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
        'flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground',
        !solid && 'border-dashed',
        className,
      )}
    >
      <Icon size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
