import { Prisma } from '@prisma/client';

// What still points at an organisation record and so blocks its permanent delete.
// Every foreign key involved is Restrict and none of these counts is filtered by
// isActive: a deactivated child still holds the key. Children therefore have to be
// deleted first, one level at a time, and user scopes withdrawn explicitly.

export interface FacultyReferences {
  departments: number;
  userScopes: number;
}

export interface DepartmentReferences {
  programs: number;
  userScopes: number;
}

export interface ProgramReferences {
  curricula: number;
  students: number;
  studentInvitations: number;
  userScopes: number;
}

type ReferenceClient = Pick<
  Prisma.TransactionClient,
  'department' | 'program' | 'curriculum' | 'userScope' | 'studentProfile' | 'studentInvitation'
>;

export async function countFacultyReferences(
  client: ReferenceClient,
  facultyId: string,
): Promise<FacultyReferences> {
  const [departments, userScopes] = await Promise.all([
    client.department.count({ where: { facultyId } }),
    client.userScope.count({ where: { facultyId } }),
  ]);
  return { departments, userScopes };
}

export async function countDepartmentReferences(
  client: ReferenceClient,
  departmentId: string,
): Promise<DepartmentReferences> {
  const [programs, userScopes] = await Promise.all([
    client.program.count({ where: { departmentId } }),
    client.userScope.count({ where: { departmentId } }),
  ]);
  return { programs, userScopes };
}

export async function countProgramReferences(
  client: ReferenceClient,
  programId: string,
): Promise<ProgramReferences> {
  const [curricula, students, studentInvitations, userScopes] = await Promise.all([
    client.curriculum.count({ where: { programId } }),
    client.studentProfile.count({ where: { programId } }),
    client.studentInvitation.count({ where: { programId } }),
    client.userScope.count({ where: { programId } }),
  ]);
  return { curricula, students, studentInvitations, userScopes };
}

const sum = (refs: object) =>
  Object.values(refs as Record<string, number>).reduce((a, b) => a + b, 0);

export const hasOrgReferences = (
  refs: FacultyReferences | DepartmentReferences | ProgramReferences,
) => sum(refs) > 0;

const list = (parts: (string | null)[]) => parts.filter(Boolean).join(' และ ');

const CHILDREN_FIRST = 'ลบรายการที่ปิดใช้งานเหล่านั้นก่อน';
const SCOPES_FIRST = 'ถอนขอบเขตสิทธิ์ของผู้ใช้ก่อน';

export function facultyBlockMessage(refs: FacultyReferences): string {
  const what = list([
    refs.departments > 0 ? `ภาควิชา ${refs.departments} รายการ` : null,
    refs.userScopes > 0 ? `ขอบเขตสิทธิ์ผู้ใช้ ${refs.userScopes} รายการ` : null,
  ]);
  const todo = [
    refs.departments > 0 ? CHILDREN_FIRST : null,
    refs.userScopes > 0 ? SCOPES_FIRST : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return `ลบถาวรไม่ได้: ยังมี${what}อยู่ภายใต้คณะนี้ (${todo})`;
}

export function departmentBlockMessage(refs: DepartmentReferences): string {
  const what = list([
    refs.programs > 0 ? `สาขา ${refs.programs} รายการ` : null,
    refs.userScopes > 0 ? `ขอบเขตสิทธิ์ผู้ใช้ ${refs.userScopes} รายการ` : null,
  ]);
  const todo = [
    refs.programs > 0 ? CHILDREN_FIRST : null,
    refs.userScopes > 0 ? SCOPES_FIRST : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return `ลบถาวรไม่ได้: ยังมี${what}อยู่ภายใต้ภาควิชานี้ (${todo})`;
}

export function programBlockMessage(refs: ProgramReferences): string {
  const what = list([
    refs.curricula > 0 ? `หลักสูตร ${refs.curricula} รายการ` : null,
    refs.students > 0 ? `นิสิต ${refs.students} คน` : null,
    refs.studentInvitations > 0 ? `คำเชิญนิสิต ${refs.studentInvitations} รายการ` : null,
    refs.userScopes > 0 ? `ขอบเขตสิทธิ์ผู้ใช้ ${refs.userScopes} รายการ` : null,
  ]);
  const todo = [
    refs.curricula > 0 ? CHILDREN_FIRST : null,
    refs.userScopes > 0 ? SCOPES_FIRST : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return `ลบถาวรไม่ได้: ยังมี${what}อยู่ภายใต้สาขานี้${todo ? ` (${todo})` : ''}`;
}
