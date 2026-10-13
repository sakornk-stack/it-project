'use client';

import type { Role } from '@eduanalyze-ai/shared-types';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { RequireRole } from '@/components/auth/require-role';

// One role gate for a whole route tree, used by the layout.tsx of /admin and
// /superadmin so no individual page can forget it. Still client-side — the
// backend's RolesGuard is the real enforcement.
export function RoleLayoutGuard({
  role,
  children,
}: Readonly<{ role: Role | Role[]; children: React.ReactNode }>) {
  return (
    <ProtectedRoute>
      <RequireRole role={role}>{children}</RequireRole>
    </ProtectedRoute>
  );
}
