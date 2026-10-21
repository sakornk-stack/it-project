import { CareerFitSummarySkeleton } from './career-fit-summary';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton, StatCardsSkeleton } from '@/components/ui/skeleton';

// Mirrors the loaded layout: header, 3 stat cards, then the "next steps"
// and PLO sections, so nothing jumps when data arrives.
export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        {/* The summary line only wraps onto a second line on phone widths (no sidebar). */}
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-2/3 max-w-sm sm:hidden" />
        </div>
      </div>

      {/* Same columns as the loaded grid; the last card spans the row at md like the readiness card. */}
      <StatCardsSkeleton
        count={3}
        className="md:grid-cols-2 lg:grid-cols-3 md:[&>:last-child]:col-span-2 lg:[&>:last-child]:col-span-1"
      />

      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-5 w-56" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-6 w-52" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="mx-auto h-64 w-64 max-w-full rounded-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 pt-6">
              <Skeleton className="h-5 w-32" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <CareerFitSummarySkeleton />
    </div>
  );
}
