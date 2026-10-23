import { Prisma } from '@prisma/client';

export interface UserReferences {
  courseInstructors: number;
  enteredRecords: number;
  studentInvitations: number;
  advisees: number;
}

type ReferenceClient = Pick<
  Prisma.TransactionClient,
  'courseInstructor' | 'studentCourseRecord' | 'studentInvitation' | 'studentProfile'
>;

export const NO_USER_REFERENCES: UserReferences = {
  courseInstructors: 0,
  enteredRecords: 0,
  studentInvitations: 0,
  advisees: 0,
};

// Every row that points at one of these accounts and would block a permanent
// delete (all four foreign keys are Restrict). Not filtered by isActive: a
// deactivated record still holds the key. Login data (roles, scopes, tokens) is
// deleted with the account, so it is not a reference.
export async function countUserReferences(
  client: ReferenceClient,
  userIds: string[],
): Promise<Map<string, UserReferences>> {
  const result = new Map<string, UserReferences>(
    userIds.map((id) => [id, { ...NO_USER_REFERENCES }]),
  );
  if (userIds.length === 0) return result;

  const [instructors, records, invitations, advisees] = await Promise.all([
    client.courseInstructor.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _count: { _all: true },
    }),
    client.studentCourseRecord.groupBy({
      by: ['enteredByUserId'],
      where: { enteredByUserId: { in: userIds } },
      _count: { _all: true },
    }),
    client.studentInvitation.groupBy({
      by: ['invitedByUserId'],
      where: { invitedByUserId: { in: userIds } },
      _count: { _all: true },
    }),
    client.studentProfile.groupBy({
      by: ['advisorUserId'],
      where: { advisorUserId: { in: userIds } },
      _count: { _all: true },
    }),
  ]);
  for (const row of instructors) result.get(row.userId)!.courseInstructors = row._count._all;
  for (const row of records) {
    if (row.enteredByUserId) result.get(row.enteredByUserId)!.enteredRecords = row._count._all;
  }
  for (const row of invitations)
    result.get(row.invitedByUserId)!.studentInvitations = row._count._all;
  for (const row of advisees) {
    if (row.advisorUserId) result.get(row.advisorUserId)!.advisees = row._count._all;
  }
  return result;
}

export function hasUserReferences(refs: UserReferences): boolean {
  return (
    refs.courseInstructors > 0 ||
    refs.enteredRecords > 0 ||
    refs.studentInvitations > 0 ||
    refs.advisees > 0
  );
}

// What to do first for each kind of reference, so a refusal is also an instruction.
export function userReferencesBlockMessage(refs: UserReferences): string {
  const parts = [
    refs.courseInstructors > 0 ? `ยังเป็นผู้สอน ${refs.courseInstructors} วิชา` : null,
    refs.enteredRecords > 0 ? `เคยบันทึกผลการเรียน ${refs.enteredRecords} รายการ` : null,
    refs.studentInvitations > 0 ? `เป็นผู้เชิญนิสิต ${refs.studentInvitations} รายการ` : null,
    refs.advisees > 0 ? `เป็นอาจารย์ที่ปรึกษานิสิต ${refs.advisees} คน` : null,
  ].filter(Boolean);
  const todo = [
    refs.courseInstructors > 0 ? 'ให้เจ้าหน้าที่ถอนการมอบหมายผู้สอนก่อน' : null,
    refs.advisees > 0 ? 'ให้เจ้าหน้าที่เปลี่ยนอาจารย์ที่ปรึกษาของนิสิตก่อน' : null,
    refs.studentInvitations > 0 ? 'รอให้คำเชิญของบัญชีนี้หมดอายุก่อน' : null,
    refs.enteredRecords > 0
      ? 'ประวัติการบันทึกผลการเรียนลบไม่ได้ จึงเก็บบัญชีนี้ไว้ในสถานะระงับ'
      : null,
  ].filter(Boolean);
  return `ลบถาวรไม่ได้: ${parts.join(', ')} (${todo.join(' · ')})`;
}
