import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Same shape as /profile: header, full-width profile card, then the security heading, the paired
// password / 2FA cards and the idle note, all in the shell column.
export function ProfileSkeleton() {
  return (
    <>
      <div className="space-y-2">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <Card className="overflow-hidden">
        <Skeleton className="h-[4.5rem] w-full rounded-none sm:h-20" />
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="-mt-10 flex flex-col gap-5 sm:-mt-12 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Skeleton className="h-20 w-20 rounded-full ring-2 ring-card sm:h-24 sm:w-24" />
              <Skeleton className="h-7 w-52 max-w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
            </div>
            <div className="grid gap-3 lg:w-[34rem] lg:max-w-[60%] lg:grid-cols-[1fr_9rem]">
              <Skeleton className="h-[4.5rem] w-full rounded-xl" />
              <Skeleton className="h-[4.5rem] w-full rounded-xl" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-5 p-4 pt-4 sm:p-6 sm:pt-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-5 w-40 max-w-full" />
                    <Skeleton className="h-4 w-full max-w-xs" />
                  </div>
                </div>
                <Skeleton className="h-11 w-full sm:w-36" />
              </CardContent>
            </Card>
          ))}
          <Skeleton className="h-[4.25rem] w-full rounded-xl lg:col-span-2" />
        </div>
      </div>
    </>
  );
}
