import type { Role, UserScope } from '@eduanalyze-ai/shared-types';

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
