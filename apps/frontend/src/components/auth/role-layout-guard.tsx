'use client';

import type { Role } from '@eduanalyze-ai/shared-types';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { ROLE_LABEL_TH, RequireRole } from '@/components/auth/require-role';
import { AccessDeniedPage } from '@/components/layout/page-states';

// One role gate for a whole route tree, used by the layout.tsx of /staff, /instructor, /admin,
// /superadmin and the (student) group so no individual page can forget it. A visitor with
// another role sees the same access-denied page inside their own shell. Still client-side — the
// backend's RolesGuard is the real enforcement.
export function RoleLayoutGuard({
  role,
  children,
}: Readonly<{ role: Role | Role[]; children: React.ReactNode }>) {
  const allowedRoles = Array.isArray(role) ? role : [role];
  const description = `หน้านี้สำหรับ${allowedRoles.map((r) => ROLE_LABEL_TH[r]).join('หรือ')}เท่านั้น`;
  return (
    <ProtectedRoute>
      <RequireRole
        role={role}
        renderDenied={(user) => <AccessDeniedPage user={user} description={description} />}
      >
        {children}
      </RequireRole>
    </ProtectedRoute>
  );
}
