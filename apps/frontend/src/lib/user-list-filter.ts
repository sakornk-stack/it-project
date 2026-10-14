import type { AdminUserSummary, Role } from '@eduanalyze-ai/shared-types';
import { roleNeedsScope } from '@/lib/user-scope-requirement';

export const ALL = 'ALL';

export type StatusFilter = typeof ALL | 'ACTIVE' | 'PENDING' | 'SUSPENDED';
export type ScopeFilter = typeof ALL | 'NO_SCOPE';

export interface UserFilters {
  search: string;
  role: Role | typeof ALL;
  status: StatusFilter;
  scope: ScopeFilter;
}

// The list opens on live accounts; suspended ones are one click away.
export const DEFAULT_USER_FILTERS: UserFilters = {
  search: '',
  role: ALL,
  status: 'ACTIVE',
  scope: ALL,
};

export const CLEARED_USER_FILTERS: UserFilters = {
  search: '',
  role: ALL,
  status: ALL,
  scope: ALL,
};

const STATUS_VALUES: readonly string[] = [ALL, 'ACTIVE', 'PENDING', 'SUSPENDED'];

export function isStatusFilter(value: string): value is StatusFilter {
  return STATUS_VALUES.includes(value);
}

// The staff roles a link may pre-select (students are not in this list).
const ROLE_PARAM_VALUES: readonly Role[] = ['SUPER_ADMIN', 'ADMIN', 'STAFF', 'INSTRUCTOR'];

// A role taken from the URL (?role=): anything outside the list is ignored, never trusted.
export function parseRoleParam(value: string | null | undefined): Role | null {
  return ROLE_PARAM_VALUES.find((role) => role === value) ?? null;
}

export function isScopeFilter(value: string): value is ScopeFilter {
  return value === ALL || value === 'NO_SCOPE';
}

// "ACTIVE" is every enabled account (waiting-for-password included), matching the
// "ใช้งานอยู่" card; "PENDING" narrows to the ones that have not set a password yet.
function matchesStatus(user: AdminUserSummary, status: StatusFilter): boolean {
  switch (status) {
    case 'ACTIVE':
      return user.isActive;
    case 'PENDING':
      return user.isActive && user.mustChangePassword;
    case 'SUSPENDED':
      return !user.isActive;
    default:
      return true;
  }
}

export function filterUsers(
  users: readonly AdminUserSummary[],
  filters: UserFilters,
): AdminUserSummary[] {
  const term = filters.search.trim().toLowerCase();
  return users.filter(
    (user) =>
      (term === '' ||
        user.fullName.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)) &&
      (filters.role === ALL || user.roles.includes(filters.role)) &&
      matchesStatus(user, filters.status) &&
      (filters.scope === ALL || (roleNeedsScope(user.roles) && user.scopes.length === 0)),
  );
}

// True when anything narrows the list (the default "active only" counts).
export function isFiltering(filters: UserFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.role !== ALL ||
    filters.status !== ALL ||
    filters.scope !== ALL
  );
}

// Pressing a stat card twice clears it.
export function toggleStatus(current: StatusFilter, target: StatusFilter): StatusFilter {
  return current === target ? ALL : target;
}
