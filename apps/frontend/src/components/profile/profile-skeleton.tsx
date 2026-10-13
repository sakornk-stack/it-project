import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ProfileSkeleton() {
  return (
    <>
      <Card className="overflow-hidden border-brand-light">
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
          <Skeleton className="h-16 w-16 shrink-0 rounded-2xl sm:h-20 sm:w-20" />
          <div className="space-y-3">
            <Skeleton className="h-7 w-52" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
            </div>
          </div>
        </CardContent>
        <CardContent className="pt-0">
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 shrink-0" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 pt-6">
          <Skeleton className="h-6 w-40" />
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
            <Skeleton className="h-11 w-36" />
          </div>
          <div className="flex items-center justify-between gap-3 border-t pt-5">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <Skeleton className="h-11 w-36" />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
