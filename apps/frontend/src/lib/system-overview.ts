import type { AdminUserSummary } from '@eduanalyze-ai/shared-types';
import { summarizeUsers } from '@/lib/admin-users';

export interface SystemUserCounts {
  superAdmin: number;
  admin: number;
  staff: number;
  instructor: number;
  total: number;
}

// Only accounts that can sign in count. Students are not in GET /users and student data is
// academic, so they are not part of this overview.
export function systemUserCounts(users: readonly AdminUserSummary[]): SystemUserCounts {
  const { byRole } = summarizeUsers(users.filter((user) => user.isActive));
  const counts = {
    superAdmin: byRole.SUPER_ADMIN,
    admin: byRole.ADMIN,
    staff: byRole.STAFF,
    instructor: byRole.INSTRUCTOR,
  };
  return {
    ...counts,
    total: counts.superAdmin + counts.admin + counts.staff + counts.instructor,
  };
}
