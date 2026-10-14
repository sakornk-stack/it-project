import type { AdminUserSummary, Role, UserScope } from '@eduanalyze-ai/shared-types';

// Mirrors the backend rules (UserManagementService / assertMayManageTarget)
// so the UI can explain a lock up front. The API stays the authority.

export const SELF_LOCK_REASON = 'ไม่สามารถระงับหรือแก้ไขบัญชีของตัวเองที่นี่';
export const STAFF_ONLY_REASON = 'ผู้ดูแลระบบจัดการได้เฉพาะบัญชีเจ้าหน้าที่เท่านั้น';
export const SUPER_ADMIN_PEER_REASON =
  'บัญชีผู้ดูแลระบบสูงสุดคนอื่นระงับหรือเปลี่ยนสถานะจากหน้านี้ไม่ได้';
export const OUTSIDE_SCOPE_REASON =
  'ผู้ใช้นี้มีขอบเขตนอกเหนือขอบเขตของคุณ จึงระงับทั้งบัญชีไม่ได้ ให้ถอดขอบเขตของคุณออกจากผู้ใช้นี้แทน';

export interface OrgIndex {
  departments: { id: string; facultyId: string }[];
  programs: { id: string; departmentId: string }[];
}

export function isScopeCovered(scope: UserScope, own: UserScope[], org: OrgIndex): boolean {
  const departmentId =
    scope.level === 'DEPARTMENT'
      ? scope.departmentId
      : scope.level === 'PROGRAM'
        ? (org.programs.find((p) => p.id === scope.programId)?.departmentId ?? null)
        : null;
  const facultyId =
    scope.level === 'FACULTY'
      ? scope.facultyId
      : (org.departments.find((d) => d.id === departmentId)?.facultyId ?? null);

  return own.some((o) => {
    if (o.level === 'FACULTY') return !!facultyId && o.facultyId === facultyId;
    if (o.level === 'DEPARTMENT') {
      return scope.level !== 'FACULTY' && !!departmentId && o.departmentId === departmentId;
    }
    return scope.level === 'PROGRAM' && o.programId === scope.programId;
  });
}

export function isStaffOnlyTarget(targetRoles: Role[]): boolean {
  return (
    targetRoles.includes('STAFF') &&
    !targetRoles.includes('ADMIN') &&
    !targetRoles.includes('SUPER_ADMIN')
  );
}

// Why role/scope edits are locked for this target, or null when allowed.
export function manageLockReason(input: {
  isSelf: boolean;
  requesterIsSuperAdmin: boolean;
  targetRoles: Role[];
}): string | null {
  if (input.isSelf) return SELF_LOCK_REASON;
  if (input.requesterIsSuperAdmin) return null;
  return isStaffOnlyTarget(input.targetRoles) ? null : STAFF_ONLY_REASON;
}

// Why suspending is blocked, or null. Scope data not loaded yet (null) never
// blocks; the API answers 403 in that case.
export function suspendBlockReason(input: {
  isSelf: boolean;
  requesterIsSuperAdmin: boolean;
  targetRoles: Role[];
  targetScopes: UserScope[];
  ownScopes: UserScope[] | null;
  org: OrgIndex | null;
}): string | null {
  const lock = manageLockReason(input);
  if (lock) return input.isSelf ? SELF_LOCK_REASON : lock;
  if (input.requesterIsSuperAdmin && input.targetRoles.includes('SUPER_ADMIN')) {
    return SUPER_ADMIN_PEER_REASON;
  }
  if (input.requesterIsSuperAdmin || !input.ownScopes || !input.org) return null;
  const org = input.org;
  const ownScopes = input.ownScopes;
  const allCovered = input.targetScopes.every((s) => isScopeCovered(s, ownScopes, org));
  return allCovered ? null : OUTSIDE_SCOPE_REASON;
}

export const PERMANENT_DELETE_BASE_PATH = '/superadmin';

// Whether the screen offers "ลบถาวร" on an account: only for a Super Admin on
// their own route tree, only once the account is suspended, never for yourself,
// another Super Admin or a student account. The API enforces the same rules.
export function canPermanentlyDelete(input: {
  basePath: string;
  requesterIsSuperAdmin: boolean;
  isSelf: boolean;
  target: { isActive: boolean; roles: Role[] };
}): boolean {
  return (
    input.requesterIsSuperAdmin &&
    input.basePath === PERMANENT_DELETE_BASE_PATH &&
    !input.isSelf &&
    !input.target.isActive &&
    !input.target.roles.includes('SUPER_ADMIN') &&
    !input.target.roles.includes('STUDENT')
  );
}

export type AccessLimitationKey =
  | 'self'
  | 'higher-level'
  | 'student'
  | 'no-role'
  | 'super-admin-peer'
  | 'outside-scope'
  | 'has-references';

export interface AccessLimitation {
  key: AccessLimitationKey;
  // One short sentence in plain words.
  reason: string;
  // The actions this limitation switches off.
  disabled: string[];
}

const ACTION_STATUS = 'ระงับ/เปิดใช้งานบัญชี';
const ACTION_SUSPEND = 'ระงับบัญชี';
const ACTION_ROLES = 'จัดการบทบาท';
const ACTION_SCOPES = 'จัดการขอบเขต';
const ACTION_DELETE = 'ลบถาวร';

// Why an Admin may not manage this account, told by who the account is. Only
// reached when manageLockReason locks it for someone who is not looking at
// themselves, i.e. an Admin on an account that is not staff-only.
function lockCause(targetRoles: Role[]): {
  key: Extract<AccessLimitationKey, 'higher-level' | 'student' | 'no-role'>;
  reason: string;
  hint: string;
} {
  if (targetRoles.includes('SUPER_ADMIN')) {
    const reason = 'บัญชีนี้เป็นผู้ดูแลระบบสูงสุด ซึ่งคุณจัดการไม่ได้';
    return { key: 'higher-level', reason, hint: 'เป็นบัญชีผู้ดูแลระบบสูงสุด' };
  }
  if (targetRoles.includes('ADMIN')) {
    const reason = 'บัญชีนี้เป็นผู้ดูแลระบบเช่นเดียวกับคุณ ซึ่งคุณจัดการไม่ได้';
    return { key: 'higher-level', reason, hint: 'เป็นบัญชีผู้ดูแลระบบ' };
  }
  if (targetRoles.includes('STUDENT')) {
    const reason = 'บัญชีนิสิตจัดการผ่านการเชิญ จึงไม่จัดการจากหน้านี้';
    return { key: 'student', reason, hint: 'เป็นบัญชีนิสิต' };
  }
  if (targetRoles.length === 0) {
    const reason = 'บัญชีนี้ยังไม่มีบทบาท ต้องให้ผู้ดูแลระบบสูงสุดเป็นผู้กำหนดบทบาทให้';
    return { key: 'no-role', reason, hint: 'ยังไม่มีบทบาท ต้องให้ผู้ดูแลระบบสูงสุดกำหนดให้' };
  }
  return {
    key: 'higher-level',
    reason: 'คุณจัดการได้เฉพาะบัญชีเจ้าหน้าที่ แต่บัญชีนี้ไม่ใช่เจ้าหน้าที่',
    hint: 'ไม่ใช่บัญชีเจ้าหน้าที่',
  };
}

// What actually holds the viewer back on this account, as plain sentences. An
// empty list means nothing does. Built from the same functions that lock the
// buttons, so the explanation cannot disagree with the screen. Your own account
// and a higher-level account lock everything, so each is reported alone.
export function accessLimitations(input: {
  basePath: string;
  isSelf: boolean;
  requesterIsSuperAdmin: boolean;
  target: Pick<AdminUserSummary, 'isActive' | 'roles' | 'scopes' | 'references'>;
  ownScopes: UserScope[] | null;
  org: OrgIndex | null;
}): AccessLimitation[] {
  const { target } = input;
  if (input.isSelf) {
    return [
      {
        key: 'self',
        reason: 'นี่คือบัญชีของคุณเอง',
        disabled: [ACTION_STATUS, ACTION_ROLES, ACTION_SCOPES, ACTION_DELETE],
      },
    ];
  }
  const lock = manageLockReason({
    isSelf: false,
    requesterIsSuperAdmin: input.requesterIsSuperAdmin,
    targetRoles: target.roles,
  });
  if (lock) {
    const { key, reason } = lockCause(target.roles);
    return [{ key, reason, disabled: [ACTION_STATUS, ACTION_ROLES, ACTION_SCOPES] }];
  }

  const limitations: AccessLimitation[] = [];
  if (target.roles.length === 0) {
    limitations.push({
      key: 'no-role',
      reason: 'บัญชีนี้ยังไม่มีบทบาท คุณกำหนดบทบาทให้ได้',
      disabled: [],
    });
  }
  if (input.requesterIsSuperAdmin && target.roles.includes('SUPER_ADMIN')) {
    limitations.push({
      key: 'super-admin-peer',
      reason: 'เป็นผู้ดูแลระบบสูงสุดเช่นเดียวกับคุณ',
      disabled: [ACTION_STATUS, ACTION_DELETE],
    });
  }
  const outside =
    target.isActive &&
    suspendBlockReason({
      isSelf: false,
      requesterIsSuperAdmin: input.requesterIsSuperAdmin,
      targetRoles: target.roles,
      targetScopes: target.scopes,
      ownScopes: input.ownScopes,
      org: input.org,
    }) === OUTSIDE_SCOPE_REASON;
  if (outside) {
    limitations.push({
      key: 'outside-scope',
      reason: 'บัญชีนี้มีขอบเขตนอกเหนือจากของคุณ จึงระงับทั้งบัญชีไม่ได้ แต่ถอดขอบเขตของคุณออกได้',
      disabled: [ACTION_SUSPEND],
    });
  }
  const refs = target.references;
  const referenceCount = refs
    ? refs.courseInstructors + refs.enteredRecords + refs.studentInvitations
    : 0;
  const deletable = canPermanentlyDelete({
    basePath: input.basePath,
    requesterIsSuperAdmin: input.requesterIsSuperAdmin,
    isSelf: false,
    target,
  });
  if (deletable && referenceCount > 0) {
    limitations.push({
      key: 'has-references',
      reason: 'บัญชีนี้ยังมีข้อมูลผูกอยู่',
      disabled: [ACTION_DELETE],
    });
  }
  return limitations;
}

// The lock reason in a few words, for a card header.
export function lockHint(lockedReason: string, targetRoles: Role[]): string {
  return lockedReason === SELF_LOCK_REASON ? 'เป็นบัญชีของคุณเอง' : lockCause(targetRoles).hint;
}
