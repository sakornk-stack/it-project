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

export type OverviewRole = 'SUPER_ADMIN' | 'ADMIN' | 'STAFF' | 'INSTRUCTOR';

export interface RoleShare {
  role: OverviewRole;
  count: number;
  // 0-100 of the total; 0 when there is no account at all.
  percent: number;
}

// Highest privilege first, the same order as the role cards.
export function roleShares(counts: SystemUserCounts): RoleShare[] {
  const rows: [OverviewRole, number][] = [
    ['SUPER_ADMIN', counts.superAdmin],
    ['ADMIN', counts.admin],
    ['STAFF', counts.staff],
    ['INSTRUCTOR', counts.instructor],
  ];
  return rows.map(([role, count]) => ({
    role,
    count,
    percent: counts.total > 0 ? (count / counts.total) * 100 : 0,
  }));
}
