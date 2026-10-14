import type { AdminUserSummary, Role } from '@eduanalyze-ai/shared-types';
import { roleShares, systemUserCounts } from './system-overview';

function user(roles: Role[], isActive = true): AdminUserSummary {
  return { id: 'x', email: 'a@b.c', fullName: 'x', isActive, roles, scopes: [] } as never;
}

describe('systemUserCounts', () => {
  it('ignores suspended accounts and totals the four account roles', () => {
    const counts = systemUserCounts([
      user(['SUPER_ADMIN']),
      user(['ADMIN']),
      user(['STAFF']),
      user(['STAFF'], false),
      user(['INSTRUCTOR']),
    ]);
    expect(counts).toEqual({
      superAdmin: 1,
      admin: 1,
      staff: 1,
      instructor: 1,
      total: 4,
    });
  });
});

describe('roleShares', () => {
  it('gives each role its real share, in privilege order', () => {
    const shares = roleShares({ superAdmin: 1, admin: 1, staff: 2, instructor: 0, total: 4 });
    expect(shares.map((s) => s.role)).toEqual(['SUPER_ADMIN', 'ADMIN', 'STAFF', 'INSTRUCTOR']);
    expect(shares.map((s) => s.percent)).toEqual([25, 25, 50, 0]);
    expect(shares.map((s) => s.count)).toEqual([1, 1, 2, 0]);
  });

  it('is all zero when there are no accounts', () => {
    const shares = roleShares({ superAdmin: 0, admin: 0, staff: 0, instructor: 0, total: 0 });
    expect(shares.every((s) => s.percent === 0 && s.count === 0)).toBe(true);
  });
});
