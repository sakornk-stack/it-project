import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

// Shared with every page-specific skeleton (dashboard-skeleton.tsx,
// profile-skeleton.tsx, etc.) — was previously redefined locally as
// `Block` in 5 separate files.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer',
        'before:bg-gradient-to-r before:from-transparent before:via-background/70 before:to-transparent',
        className,
      )}
    />
  );
}

// Generic table placeholder — header row + N data rows, each split evenly
// across `cols` columns. For pages whose real table columns vary widely in
// width, a page-specific composition is more honest than this default.
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-border pb-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Stat card row — icon + label + number, same shape reused across
// dashboard/staff-dashboard/curriculum-dashboard's summary cards.
export function StatCardsSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-3 pt-6">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Vertical list/panel placeholder — a title-sized row followed by N
// item-sized rows, matching timeline/assessment-list style panels.
export function ListSkeleton({ items = 4 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
