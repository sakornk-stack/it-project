import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Same footprint as a `large` StatCard: a 48px icon tile, a label line, then the figure.
export function OverviewCardsSkeleton({
  count,
  className,
}: Readonly<{ count: number; className?: string }>) {
  return (
    <div className={cn('grid grid-cols-1 gap-4', className)} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <Skeleton className="mb-3 h-12 w-12 rounded-xl" />
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-9 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
