import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Same order as the loaded dashboard: the summary lines, the course rows, then
// the follow-up table.
export function InstructorDashboardSkeleton() {
  return (
    <div className="space-y-6" role="status">
      <span className="sr-only">กำลังโหลดภาพรวมรายวิชา</span>
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <div className="space-y-2 rounded-xl border p-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}

// Course-card-grid placeholder for pages whose only content is
// InstructorCourseGrid (e.g. My Courses) — matches InstructorCourseCard's
// shape (code+name, then a stat line) rather than reusing
// InstructorDashboardSkeleton's stat-card-shaped first row, which doesn't
// resemble a course card.
export function InstructorCourseGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-2 pt-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Stacked-section placeholder for InstructorCourseTimeline (My Courses'
// grouped-by-year/semester view) — doesn't reuse InstructorCourseGridSkeleton
// above, whose grid-of-cards shape doesn't match this page's sectioned list.
// Same shape as the loaded page: the latest term's rows, then one collapsed bar.
export function InstructorCourseTimelineSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-56" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}

// Mirrors the loaded course page: the course switcher (a bar on phones, a
// row of pills from sm), the header card with its title and chips, then the
// four tabs on the page and the first cards of the content. With
// the switcher drawn up front the header does not move when the data arrives.
// `withSwitcher` is off for the Suspense fallback, which has no shell yet.
export function InstructorCourseSkeleton({ withSwitcher = false }: { withSwitcher?: boolean }) {
  return (
    <div className="space-y-4">
      {withSwitcher && (
        <>
          <Skeleton className="h-[3.375rem] w-full rounded-lg sm:hidden" />
          <div className="hidden flex-wrap gap-2 sm:flex">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-72 max-w-full rounded-full" />
            ))}
          </div>
        </>
      )}
      <div className="space-y-3 rounded-xl border border-slate-200 p-4 sm:p-6">
        <Skeleton className="h-8 w-64 max-w-full" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-40 rounded-full" />
        </div>
      </div>
      <div className="flex gap-x-4 border-b border-slate-200">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="mb-px h-11 w-24" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Skeleton className="h-72 w-full rounded-xl xl:col-span-2" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}
