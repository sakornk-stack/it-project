import { Role } from '@prisma/client';

// One flat level of plain values: enough for every allow-listed snapshot
// (grade ids, active flags, program/curriculum ids, admission year).
export type AuditSnapshot = Record<string, string | number | boolean | null>;

const SECRET_KEY = /password|token|hash|secret|email/i;

// A programmer error, not a client one: thrown before anything is written, so
// the transaction (and the change it guards) rolls back instead of storing a
// snapshot that carries a secret or a contact detail.
export function assertNoSecretKeys(snapshot: AuditSnapshot | null | undefined): void {
  if (!snapshot) return;
  const offending = Object.keys(snapshot).filter((key) => SECRET_KEY.test(key));
  if (offending.length > 0) {
    throw new Error(`Audit snapshot must not contain: ${offending.join(', ')}`);
  }
}

// Most-privileged role wins, same order StudentCourseRecord.enteredByRole uses.
export function actingRole(roles: Role[]): Role {
  if (roles.includes('SUPER_ADMIN')) return Role.SUPER_ADMIN;
  if (roles.includes('ADMIN')) return Role.ADMIN;
  if (roles.includes('STAFF')) return Role.STAFF;
  if (roles.includes('INSTRUCTOR')) return Role.INSTRUCTOR;
  return Role.STUDENT;
}
