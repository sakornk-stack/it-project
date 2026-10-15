import { Skeleton } from '@/components/ui/skeleton';

// The small centred mark shown before a page's real layout can mount (the same
// one ProtectedRoute and RequireRole show while the user is being resolved).
export function AuthLoadingScreen() {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center">
      <span className="sr-only">กำลังโหลด</span>
      <div className="space-y-3">
        <Skeleton className="mx-auto h-10 w-10 rounded-full" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}
