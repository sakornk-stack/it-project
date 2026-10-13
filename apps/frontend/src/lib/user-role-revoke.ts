import type { Role } from '@eduanalyze-ai/shared-types';

// DELETE /users/:id/roles/:role has no "last role" guard and login does not
// require a role, so the account keeps signing in but reaches no feature.
export function revokeRoleDescription(roleLabel: string, isLastRole: boolean): string {
  const base = `ผู้ใช้นี้จะไม่มีบทบาท${roleLabel}อีกต่อไป และใช้งานส่วนของบทบาทนี้ไม่ได้ทันที`;
  return isLastRole
    ? `${base} นี่เป็นบทบาทสุดท้าย บัญชีนี้จะไม่มีบทบาทเหลืออยู่ แม้ยังเข้าสู่ระบบได้ แต่จะใช้งานส่วนใดของระบบไม่ได้จนกว่าจะเพิ่มบทบาทใหม่`
    : base;
}

export function isLastRole(roles: readonly Role[], role: Role): boolean {
  return roles.length === 1 && roles[0] === role;
}
