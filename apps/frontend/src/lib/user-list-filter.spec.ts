import type { AdminUserSummary } from '@eduanalyze-ai/shared-types';
import {
  CLEARED_USER_FILTERS,
  DEFAULT_USER_FILTERS,
  filterUsers,
  isFiltering,
  isScopeFilter,
  isStatusFilter,
  parseRoleParam,
  toggleStatus,
} from './user-list-filter';

function user(overrides: Partial<AdminUserSummary>): AdminUserSummary {
  return {
    id: 'u',
    email: 'a@example.com',
    fullName: 'สมชาย ใจดี',
    roles: ['STAFF'],
    scopes: [],
    isActive: true,
    mustChangePassword: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  } as AdminUserSummary;
}

const active = user({ id: 'active', email: 'active@example.com' });
const pending = user({ id: 'pending', email: 'pending@example.com', mustChangePassword: true });
const suspended = user({ id: 'suspended', email: 'gone@example.com', isActive: false });
const all = [active, pending, suspended];
const ids = (list: AdminUserSummary[]) => list.map((u) => u.id);

describe('filterUsers', () => {
  it('opens on enabled accounts, waiting-for-password included', () => {
    expect(ids(filterUsers(all, DEFAULT_USER_FILTERS))).toEqual(['active', 'pending']);
  });

  it('keeps everyone when cleared', () => {
    expect(ids(filterUsers(all, CLEARED_USER_FILTERS))).toEqual(['active', 'pending', 'suspended']);
  });

  it('narrows to the accounts that have not set a password', () => {
    expect(ids(filterUsers(all, { ...CLEARED_USER_FILTERS, status: 'PENDING' }))).toEqual([
      'pending',
    ]);
  });

  it('narrows to suspended accounts', () => {
    expect(ids(filterUsers(all, { ...CLEARED_USER_FILTERS, status: 'SUSPENDED' }))).toEqual([
      'suspended',
    ]);
  });

  it('searches name or email, ignoring case and surrounding spaces', () => {
    expect(ids(filterUsers(all, { ...CLEARED_USER_FILTERS, search: '  GONE@ ' }))).toEqual([
      'suspended',
    ]);
  });

  it('filters by role and by missing scope', () => {
    const instructor = user({ id: 'inst', roles: ['INSTRUCTOR'] });
    const list = [active, instructor];
    expect(ids(filterUsers(list, { ...CLEARED_USER_FILTERS, role: 'INSTRUCTOR' }))).toEqual([
      'inst',
    ]);
    expect(ids(filterUsers(list, { ...CLEARED_USER_FILTERS, scope: 'NO_SCOPE' }))).toEqual([
      'active',
    ]);
  });
});

describe('isFiltering', () => {
  it('is true for the default view and false once cleared', () => {
    expect(isFiltering(DEFAULT_USER_FILTERS)).toBe(true);
    expect(isFiltering(CLEARED_USER_FILTERS)).toBe(false);
  });

  it('ignores a blank search', () => {
    expect(isFiltering({ ...CLEARED_USER_FILTERS, search: '   ' })).toBe(false);
  });
});

describe('toggleStatus', () => {
  it('selects, then clears on the second press', () => {
    expect(toggleStatus('ALL', 'PENDING')).toBe('PENDING');
    expect(toggleStatus('PENDING', 'PENDING')).toBe('ALL');
    expect(toggleStatus('ACTIVE', 'SUSPENDED')).toBe('SUSPENDED');
  });
});

describe('type guards', () => {
  it('accept only known values', () => {
    expect(isStatusFilter('PENDING')).toBe(true);
    expect(isStatusFilter('nope')).toBe(false);
    expect(isScopeFilter('NO_SCOPE')).toBe(true);
    expect(isScopeFilter('PENDING')).toBe(false);
  });
});

describe('parseRoleParam', () => {
  it('accepts the four staff roles', () => {
    expect(parseRoleParam('SUPER_ADMIN')).toBe('SUPER_ADMIN');
    expect(parseRoleParam('ADMIN')).toBe('ADMIN');
    expect(parseRoleParam('STAFF')).toBe('STAFF');
    expect(parseRoleParam('INSTRUCTOR')).toBe('INSTRUCTOR');
  });

  it('ignores anything else', () => {
    expect(parseRoleParam('STUDENT')).toBeNull();
    expect(parseRoleParam('admin')).toBeNull();
    expect(parseRoleParam('ALL')).toBeNull();
    expect(parseRoleParam('')).toBeNull();
    expect(parseRoleParam(null)).toBeNull();
    expect(parseRoleParam(undefined)).toBeNull();
  });
});
