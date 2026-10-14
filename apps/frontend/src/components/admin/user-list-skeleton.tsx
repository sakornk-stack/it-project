import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Same shape as a real row (avatar, two-line identity, role, scope, status), so the
// list does not jump when the data arrives. The right-hand pieces drop away on a
// phone, where the real list is a column of cards.
function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-b-0">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2 xl:flex-none xl:basis-[30%]">
        <Skeleton className="h-4 w-40 max-w-full" />
        <Skeleton className="h-3 w-48 max-w-full" />
      </div>
      <Skeleton className="hidden h-5 w-20 rounded-full xl:block xl:basis-[14%]" />
      <Skeleton className="hidden h-4 w-40 xl:block xl:basis-[22%]" />
      <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
      <Skeleton className="hidden h-9 w-9 shrink-0 xl:block" />
    </div>
  );
}

export function UserListSkeleton({ rows = 6 }: Readonly<{ rows?: number }>) {
  return (
    <Card aria-busy="true">
      <CardHeader>
        <CardTitle>รายชื่อผู้ใช้งาน</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Skeleton className="h-11 w-full sm:w-72" />
          <Skeleton className="h-11 w-full sm:w-44" />
          <Skeleton className="h-11 w-full sm:w-44" />
          <Skeleton className="h-11 w-full sm:w-52" />
        </div>
        <div>
          {Array.from({ length: rows }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
