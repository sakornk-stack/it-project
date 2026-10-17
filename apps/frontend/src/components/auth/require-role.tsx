'use client';

import type { CurrentUserResponse, Role } from '@eduanalyze-ai/shared-types';
import { useAuth } from '@/lib/auth-context';
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

// The role gate behind every RoleLayoutGuard: waits for the user, then renders children for an
// allowed role or `renderDenied` for anyone else (the guard passes the shared access-denied page).
// `role` accepts either one role or several (any-of) — e.g. /admin/users
// is reachable by both SUPER_ADMIN and ADMIN, unlike /superadmin/academic-years
// which is SUPER_ADMIN-only.
export function RequireRole({
  role,
  children,
  renderDenied,
}: {
  role: Role | Role[];
  children: React.ReactNode;
  renderDenied: (user: CurrentUserResponse) => React.ReactNode;
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
    return <>{renderDenied(user)}</>;
  }

  return <>{children}</>;
}
