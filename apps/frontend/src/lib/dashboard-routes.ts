import type { Role } from '@eduanalyze-ai/shared-types';
import { primaryRoleFor } from '@/lib/role-priority';
import { sanitizeNextPath } from '@/lib/safe-next-path';

// Highest-privilege dashboard first — kept in one place so the login
// redirect and the landing-page "go to dashboard" button never disagree
// on where a given account's home is.
const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: '/superadmin/system-overview',
  ADMIN: '/admin/overview',
  STAFF: '/staff/dashboard',
  INSTRUCTOR: '/instructor/dashboard',
  STUDENT: '/dashboard',
};

export function homeRouteForRole(role: Role): string {
  return ROLE_HOME[role];
}

export function resolveHomeRoute(roles: Role[]): string {
  return homeRouteForRole(primaryRoleFor(roles));
}

// Where to land after signing in: the page the user was bounced away from
// (ProtectedRoute's ?next=), if it is a safe in-app path, else their home.
export function resolvePostLoginRoute(next: string | null | undefined, roles: Role[]): string {
  return sanitizeNextPath(next) ?? resolveHomeRoute(roles);
}
