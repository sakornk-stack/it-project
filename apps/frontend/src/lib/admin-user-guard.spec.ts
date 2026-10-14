import type { Role, UserScope } from '@eduanalyze-ai/shared-types';
import {
  OUTSIDE_SCOPE_REASON,
  SELF_LOCK_REASON,
  STAFF_ONLY_REASON,
  SUPER_ADMIN_PEER_REASON,
  accessLimitations,
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

describe('accessLimitations', () => {
  const input: Parameters<typeof accessLimitations>[0] = {
    basePath: '/admin',
    isSelf: false,
    requesterIsSuperAdmin: false,
    target: {
      isActive: true,
      roles: ['STAFF'],
      scopes: [scope('PROGRAM', 'p1')],
    },
    ownScopes: [scope('DEPARTMENT', 'd1')],
    org,
  };
  const keys = (change: Partial<typeof input>) =>
    accessLimitations({ ...input, ...change }).map((l) => l.key);
  const superAdmin = { basePath: '/superadmin', requesterIsSuperAdmin: true };
  const suspended = (extra: object = {}) => ({
    target: { isActive: false, roles: ['STAFF' as Role], scopes: [], ...extra },
  });

  it('reports nothing for an Admin on a staff account inside their scope', () => {
    expect(keys({})).toEqual([]);
  });

  it('reports your own account alone, with every action switched off', () => {
    const [only, ...rest] = accessLimitations({ ...input, ...superAdmin, isSelf: true });
    expect(only.key).toBe('self');
    expect(only.disabled).toHaveLength(4);
    expect(rest).toEqual([]);
  });

  it('reports an Admin or Super Admin account alone for an Admin', () => {
    expect(keys({ target: { isActive: true, roles: ['ADMIN'], scopes: [] } })).toEqual([
      'higher-level',
    ]);
    expect(keys({ target: { isActive: true, roles: ['SUPER_ADMIN'], scopes: [] } })).toEqual([
      'higher-level',
    ]);
  });

  it('reports a student account as its own case for an Admin', () => {
    expect(keys({ target: { isActive: true, roles: ['STUDENT'], scopes: [] } })).toEqual([
      'student',
    ]);
  });

  it('reports a non-staff teaching account as higher-level wording, not as no-role', () => {
    expect(keys({ target: { isActive: true, roles: ['INSTRUCTOR'], scopes: [] } })).toEqual([
      'higher-level',
    ]);
  });

  it('tells an Admin an account without roles needs a Super Admin, switching the actions off', () => {
    const [only, ...rest] = accessLimitations({
      ...input,
      target: { isActive: true, roles: [], scopes: [] },
    });
    expect(only.key).toBe('no-role');
    expect(only.reason).toContain('ผู้ดูแลระบบสูงสุดเป็นผู้กำหนดบทบาท');
    expect(only.disabled).toHaveLength(3);
    expect(rest).toEqual([]);
  });

  it('tells a Super Admin an account without roles can be given one, with nothing switched off', () => {
    const [only, ...rest] = accessLimitations({
      ...input,
      ...superAdmin,
      target: { isActive: true, roles: [], scopes: [] },
    });
    expect(only.key).toBe('no-role');
    expect(only.reason).toContain('คุณกำหนดบทบาทให้ได้');
    expect(only.disabled).toEqual([]);
    expect(rest).toEqual([]);
  });

  it('reports another Super Admin to a Super Admin', () => {
    expect(
      keys({ ...superAdmin, target: { isActive: true, roles: ['SUPER_ADMIN'], scopes: [] } }),
    ).toEqual(['super-admin-peer']);
  });

  it('reports a unit outside the Admin scope while the account is active', () => {
    expect(keys({ target: { ...input.target, scopes: [scope('PROGRAM', 'p2')] } })).toEqual([
      'outside-scope',
    ]);
  });

  it('does not report outside-scope for a suspended account (reactivating is allowed)', () => {
    expect(
      keys({ target: { ...input.target, isActive: false, scopes: [scope('PROGRAM', 'p2')] } }),
    ).toEqual([]);
  });

  it('does not report outside-scope while the Admin scopes are still loading', () => {
    expect(
      keys({ ownScopes: null, target: { ...input.target, scopes: [scope('PROGRAM', 'p2')] } }),
    ).toEqual([]);
  });

  it('reports linked data on a suspended account a Super Admin may delete', () => {
    const references = { courseInstructors: 1, enteredRecords: 0, studentInvitations: 0 };
    expect(keys({ ...superAdmin, ...suspended({ references }) })).toEqual(['has-references']);
  });

  it('reports nothing for a suspended account without linked data', () => {
    const references = { courseInstructors: 0, enteredRecords: 0, studentInvitations: 0 };
    expect(keys({ ...superAdmin, ...suspended({ references }) })).toEqual([]);
  });

  it('does not mention linked data to an Admin, who cannot delete', () => {
    const references = { courseInstructors: 1, enteredRecords: 0, studentInvitations: 0 };
    expect(keys(suspended({ references }))).toEqual([]);
  });
});
