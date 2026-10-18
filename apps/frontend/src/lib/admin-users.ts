import type { AdminUserSummary, Role } from '@eduanalyze-ai/shared-types';
import { roleNeedsScope } from '@/lib/user-scope-requirement';

// The counts on the Admin users page, taken from the one list the page already
// loads (GET /users), so the cards and the table cannot disagree.

export interface UserSummary {
  total: number;
  active: number;
  suspended: number;
  // People who hold the role, so someone with two roles counts under both.
  byRole: Record<Exclude<Role, 'STUDENT'>, number>;
  // People holding ADMIN or STAFF (or both), each counted once.
  adminOrStaff: number;
  // Active accounts that have not set a password yet (the "รอตั้งรหัสผ่าน" badge).
  pendingPassword: number;
  // STAFF/ADMIN accounts with no scope: they can see nothing yet.
  withoutScope: number;
}

export function summarizeUsers(users: readonly AdminUserSummary[]): UserSummary {
  const summary: UserSummary = {
    total: users.length,
    active: 0,
    suspended: 0,
    byRole: { INSTRUCTOR: 0, STAFF: 0, ADMIN: 0, SUPER_ADMIN: 0 },
    adminOrStaff: 0,
    pendingPassword: 0,
    withoutScope: 0,
  };
  for (const user of users) {
    if (user.isActive) summary.active += 1;
    else summary.suspended += 1;
    for (const role of user.roles) {
      if (role !== 'STUDENT') summary.byRole[role] += 1;
    }
    if (user.isActive && user.mustChangePassword) summary.pendingPassword += 1;
    if (user.roles.includes('ADMIN') || user.roles.includes('STAFF')) summary.adminOrStaff += 1;
    if (roleNeedsScope(user.roles) && user.scopes.length === 0) summary.withoutScope += 1;
  }
  return summary;
}

// Highest privilege first; a person with several roles sorts by their top one.
const ROLE_ORDER: Role[] = ['SUPER_ADMIN', 'ADMIN', 'STAFF', 'INSTRUCTOR', 'STUDENT'];

function roleRank(roles: readonly Role[]): number {
  const ranks = roles.map((role) => ROLE_ORDER.indexOf(role));
  return ranks.length === 0 ? ROLE_ORDER.length : Math.min(...ranks);
}

// The list's fixed base order: role, then name, then email. Column sorting
// is stable, so rows that tie on the chosen column keep this order.
export function compareUsersDefault(a: AdminUserSummary, b: AdminUserSummary): number {
  return (
    roleRank(a.roles) - roleRank(b.roles) ||
    a.fullName.localeCompare(b.fullName, 'th') ||
    a.email.localeCompare(b.email, 'th')
  );
}

// One decimal, null when there is nothing to divide by.
export function activeShare(summary: Pick<UserSummary, 'total' | 'active'>): number | null {
  return summary.total === 0 ? null : Math.round((summary.active / summary.total) * 1000) / 10;
}

// "8 ก.ย. 2568" — the Thai locale already uses the Buddhist calendar.
export function formatThaiDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Sign-ins are recorded from 2026-10 on, so null means "not since then", not "never".
export const NO_LAST_LOGIN_LABEL = 'ยังไม่มีบันทึก';

export function formatLastLogin(iso: string | null, withTime = false): string {
  if (!iso) return NO_LAST_LOGIN_LABEL;
  return withTime ? formatThaiDateTime(iso) : formatThaiDate(iso);
}

// "8 ก.ย. 2568 14:05" — for events where the time of day matters (last sign-in, history).
export function formatThaiDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
