import type { AdminUserSummary, Role } from '@eduanalyze-ai/shared-types';
import { activeShare, compareUsersDefault, formatThaiDate, summarizeUsers } from './admin-users';

function user(roles: Role[], opts: { isActive?: boolean; scopes?: number } = {}): AdminUserSummary {
  return {
    id: Math.random().toString(36),
    email: 'a@b.c',
    fullName: 'x',
    isActive: opts.isActive ?? true,
    mustChangePassword: false,
    createdAt: '2025-09-08T00:00:00.000Z',
    updatedAt: '2025-09-08T00:00:00.000Z',
    roles,
    scopes: Array.from({ length: opts.scopes ?? 0 }, (_, i) => ({ id: `s${i}` })) as never,
  };
}

describe('summarizeUsers', () => {
  it('counts totals, suspended and each role', () => {
    const summary = summarizeUsers([
      user(['INSTRUCTOR']),
      user(['INSTRUCTOR'], { isActive: false }),
      user(['STAFF'], { scopes: 1 }),
      user(['ADMIN'], { scopes: 1 }),
    ]);
    expect(summary).toMatchObject({
      total: 4,
      active: 3,
      suspended: 1,
      byRole: { INSTRUCTOR: 2, STAFF: 1, ADMIN: 1, SUPER_ADMIN: 0 },
    });
  });

  it('counts a person with two roles under both', () => {
    const summary = summarizeUsers([user(['INSTRUCTOR', 'STAFF'], { scopes: 1 })]);
    expect(summary.byRole.INSTRUCTOR).toBe(1);
    expect(summary.byRole.STAFF).toBe(1);
    expect(summary.total).toBe(1);
  });

  it('flags only STAFF/ADMIN without a scope', () => {
    const summary = summarizeUsers([
      user(['STAFF']),
      user(['ADMIN'], { scopes: 1 }),
      user(['INSTRUCTOR']),
      user(['SUPER_ADMIN']),
    ]);
    expect(summary.withoutScope).toBe(1);
  });

  it('counts a person who is both ADMIN and STAFF once in adminOrStaff', () => {
    const summary = summarizeUsers([
      user(['ADMIN', 'STAFF'], { scopes: 1 }),
      user(['STAFF'], { scopes: 1 }),
      user(['INSTRUCTOR']),
    ]);
    expect(summary.adminOrStaff).toBe(2);
  });

  it('handles an empty list', () => {
    expect(summarizeUsers([]).total).toBe(0);
  });
});

describe('activeShare', () => {
  it('rounds to one decimal', () => {
    expect(activeShare({ total: 1420, active: 1388 })).toBe(97.7);
  });
  it('is null with no accounts', () => {
    expect(activeShare({ total: 0, active: 0 })).toBeNull();
  });
});

describe('formatThaiDate', () => {
  it('uses the Buddhist year', () => {
    expect(formatThaiDate('2025-09-08T05:00:00.000Z')).toContain('2568');
  });
  it('returns a dash for a bad date', () => {
    expect(formatThaiDate('nope')).toBe('—');
  });
});

describe('pendingPassword', () => {
  it('counts only active accounts that have not set a password', () => {
    const pending = { ...user(['STAFF'], { scopes: 1 }), mustChangePassword: true };
    const suspended = { ...user(['STAFF'], { isActive: false }), mustChangePassword: true };
    expect(summarizeUsers([pending, suspended, user(['ADMIN'])]).pendingPassword).toBe(1);
  });
});

describe('compareUsersDefault', () => {
  const named = (roles: Role[], fullName: string, email: string) => ({
    ...user(roles),
    fullName,
    email,
  });

  it('orders by role, then name, then email', () => {
    const rows = [
      named(['INSTRUCTOR'], 'กอ', 'a@x.c'),
      named(['STAFF'], 'ขอ', 'b@x.c'),
      named(['ADMIN'], 'ขอ', 'z@x.c'),
      named(['ADMIN'], 'ขอ', 'a@x.c'),
      named(['SUPER_ADMIN'], 'ซอ', 'c@x.c'),
    ];
    const order = [...rows].sort(compareUsersDefault).map((u) => `${u.roles[0]}:${u.email}`);
    expect(order).toEqual([
      'SUPER_ADMIN:c@x.c',
      'ADMIN:a@x.c',
      'ADMIN:z@x.c',
      'STAFF:b@x.c',
      'INSTRUCTOR:a@x.c',
    ]);
  });

  it('ranks a multi-role person by their highest role', () => {
    const both = named(['INSTRUCTOR', 'ADMIN'], 'กอ', 'a@x.c');
    expect(compareUsersDefault(both, named(['STAFF'], 'กอ', 'a@x.c'))).toBeLessThan(0);
  });
});
