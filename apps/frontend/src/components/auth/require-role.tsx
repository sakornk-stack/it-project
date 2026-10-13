'use client';

import Link from 'next/link';
import type { Role } from '@eduanalyze-ai/shared-types';
import { useAuth } from '@/lib/auth-context';
import { resolveHomeRoute } from '@/lib/dashboard-routes';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SemanticTone } from '@/lib/tone';

export { primaryRoleFor } from '@/lib/role-priority';

export const ROLE_LABEL_TH: Record<Role, string> = {
  STUDENT: 'นิสิต',
  INSTRUCTOR: 'อาจารย์',
  STAFF: 'เจ้าหน้าที่',
  ADMIN: 'ผู้ดูแลระบบ',
  SUPER_ADMIN: 'ผู้ดูแลระบบสูงสุด',
};

export const ROLE_BADGE_TONE: Record<Role, SemanticTone> = {
  STUDENT: 'neutral',
  INSTRUCTOR: 'success',
  STAFF: 'neutral',
  ADMIN: 'warning',
  SUPER_ADMIN: 'danger',
};

// Reproduces the inline-message role gate pattern copy-pasted across every
// STUDENT page (e.g. app/dashboard/page.tsx's `isStudent` check) as a
// shared component, for pages restricted to a role other than STUDENT.
// `role` accepts either one role or several (any-of) — e.g. /admin/users
// is reachable by both SUPER_ADMIN and ADMIN, unlike /admin/academic-years
// which is SUPER_ADMIN-only.
export function RequireRole({
  role,
  children,
}: {
  role: Role | Role[];
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const allowedRoles = Array.isArray(role) ? role : [role];

  if (!user) {
    // Fires before the page shell mounts (same reasoning as
    // ProtectedRoute's loading branch) — a small centered mark rather than
    // a page-shaped skeleton, since there's no real layout to mimic yet.
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-3">
          <Skeleton className="mx-auto h-10 w-10 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  if (!allowedRoles.some((allowedRole) => user.roles.includes(allowedRole))) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground">
            หน้านี้สำหรับ{allowedRoles.map((allowedRole) => ROLE_LABEL_TH[allowedRole]).join('หรือ')}เท่านั้น
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href={resolveHomeRoute(user.roles)}>กลับไปแดชบอร์ดของคุณ</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
