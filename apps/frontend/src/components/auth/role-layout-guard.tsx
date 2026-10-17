'use client';

import type { Role } from '@eduanalyze-ai/shared-types';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { RequireRole } from '@/components/auth/require-role';
import { StudentOnlyPage } from '@/components/layout/page-states';

// One role gate for a whole route tree, used by the layout.tsx of /staff, /instructor, /admin and
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

// Same gate for the student pages (the (student) route group), which have always shown a
// non-student the "students only" view inside their own shell instead of the bare message.
// Defined here, in a client file, because a layout (server) can't pass the render function.
export function StudentLayoutGuard({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ProtectedRoute>
      <RequireRole role="STUDENT" renderDenied={(user) => <StudentOnlyPage user={user} />}>
        {children}
      </RequireRole>
    </ProtectedRoute>
  );
}
