import type { Role, UserScope } from '@eduanalyze-ai/shared-types';
import {
  OUTSIDE_SCOPE_REASON,
  SELF_LOCK_REASON,
  STAFF_ONLY_REASON,
  SUPER_ADMIN_PEER_REASON,
  canPermanentlyDelete,
  suspendBlockReason,
  manageLockReason,
  type OrgIndex,
} from './admin-user-guard';

const org: OrgIndex = {
  departments: [
    { id: 'd1', facultyId: 'f1' },
    { id: 'd2', facultyId: 'f1' },
  ],
  programs: [
    { id: 'p1', departmentId: 'd1' },
    { id: 'p2', departmentId: 'd2' },
  ],
};

function scope(level: UserScope['level'], id: string): UserScope {
  return {
    id: `s-${id}`,
    userId: 'u',
    level,
    facultyId: level === 'FACULTY' ? id : null,
    departmentId: level === 'DEPARTMENT' ? id : null,
    programId: level === 'PROGRAM' ? id : null,
    createdAt: '',
  };
}

const base = {
  isSelf: false,
  requesterIsSuperAdmin: false,
  targetRoles: ['STAFF' as const],
  targetScopes: [scope('PROGRAM', 'p1')],
  ownScopes: [scope('DEPARTMENT', 'd1')],
  org,
};

describe('suspendBlockReason', () => {
  it('blocks suspending yourself, even as SUPER_ADMIN', () => {
    expect(suspendBlockReason({ ...base, isSelf: true })).toBe(SELF_LOCK_REASON);
    expect(suspendBlockReason({ ...base, isSelf: true, requesterIsSuperAdmin: true })).toBe(
      SELF_LOCK_REASON,
    );
  });

  it('blocks an ADMIN from touching ADMIN, SUPER_ADMIN or non-STAFF accounts', () => {
    for (const roles of [['ADMIN'], ['STAFF', 'ADMIN'], ['SUPER_ADMIN'], ['INSTRUCTOR']] as const) {
      expect(suspendBlockReason({ ...base, targetRoles: [...roles] })).toBe(STAFF_ONLY_REASON);
    }
  });

  it('blocks a SUPER_ADMIN from suspending another SUPER_ADMIN', () => {
    expect(
      suspendBlockReason({ ...base, requesterIsSuperAdmin: true, targetRoles: ['SUPER_ADMIN'] }),
    ).toBe(SUPER_ADMIN_PEER_REASON);
  });

  it('lets SUPER_ADMIN suspend an ADMIN with scopes anywhere', () => {
    expect(
      suspendBlockReason({
        ...base,
        requesterIsSuperAdmin: true,
        targetRoles: ['ADMIN'],
        targetScopes: [scope('PROGRAM', 'p2')],
      }),
    ).toBeNull();
  });

  it('allows when every target scope sits inside the ADMIN scope', () => {
    expect(suspendBlockReason(base)).toBeNull();
    expect(
      suspendBlockReason({
        ...base,
        ownScopes: [scope('FACULTY', 'f1')],
        targetScopes: [scope('PROGRAM', 'p1'), scope('DEPARTMENT', 'd2')],
      }),
    ).toBeNull();
  });

  it('blocks when one scope is outside, pointing to removing their own scope', () => {
    const reason = suspendBlockReason({
      ...base,
      targetScopes: [scope('PROGRAM', 'p1'), scope('PROGRAM', 'p2')],
    });
    expect(reason).toBe(OUTSIDE_SCOPE_REASON);
    expect(reason).toContain('ถอดขอบเขตของคุณออก');
  });

  it('a faculty-level target scope is not covered by a department-level one', () => {
    expect(suspendBlockReason({ ...base, targetScopes: [scope('FACULTY', 'f1')] })).toBe(
      OUTSIDE_SCOPE_REASON,
    );
  });

  it('does not block while own scopes or the org lists are still loading', () => {
    expect(suspendBlockReason({ ...base, ownScopes: null })).toBeNull();
    expect(suspendBlockReason({ ...base, org: null })).toBeNull();
  });
});

describe('manageLockReason', () => {
  it('locks role/scope edits for self and non-STAFF targets, not for STAFF', () => {
    expect(
      manageLockReason({ isSelf: true, requesterIsSuperAdmin: true, targetRoles: ['ADMIN'] }),
    ).toBe(SELF_LOCK_REASON);
    expect(
      manageLockReason({ isSelf: false, requesterIsSuperAdmin: false, targetRoles: ['ADMIN'] }),
    ).toBe(STAFF_ONLY_REASON);
    expect(
      manageLockReason({ isSelf: false, requesterIsSuperAdmin: false, targetRoles: ['STAFF'] }),
    ).toBeNull();
  });
});

describe('canPermanentlyDelete', () => {
  const base = {
    basePath: '/superadmin',
    requesterIsSuperAdmin: true,
    isSelf: false,
    target: { isActive: false, roles: ['STAFF'] as Role[] },
  };

  it('is offered for a suspended staff account to a Super Admin on /superadmin', () => {
    expect(canPermanentlyDelete(base)).toBe(true);
  });

  it.each([
    ['the /admin route tree', { basePath: '/admin' }],
    ['an Admin viewer', { requesterIsSuperAdmin: false }],
    ['your own account', { isSelf: true }],
    ['an account that is still active', { target: { isActive: true, roles: ['STAFF'] as Role[] } }],
    ['a Super Admin account', { target: { isActive: false, roles: ['SUPER_ADMIN'] as Role[] } }],
    ['a student account', { target: { isActive: false, roles: ['STUDENT'] as Role[] } }],
  ])('is not offered for %s', (_label, change) => {
    expect(canPermanentlyDelete({ ...base, ...change })).toBe(false);
  });
});
