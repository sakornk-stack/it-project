import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface SemesterReferences {
  records: number;
}

type ReferenceClient = Pick<Prisma.TransactionClient, 'studentCourseRecord'>;

// Every row that points at one of these semesters. Not filtered by isActive: a
// deactivated record still holds the foreign key, and a permanent delete would orphan
// or destroy it.
export async function countSemesterReferences(
  client: ReferenceClient,
  semesterIds: string[],
): Promise<Map<string, SemesterReferences>> {
  const result = new Map<string, SemesterReferences>(
    semesterIds.map((id) => [id, { records: 0 }]),
  );
  if (semesterIds.length === 0) return result;

  const records = await client.studentCourseRecord.groupBy({
    by: ['semesterId'],
    where: { semesterId: { in: semesterIds } },
    _count: { _all: true },
  });
  for (const row of records) result.get(row.semesterId)!.records = row._count._all;
  return result;
}

export function sumReferences(refs: Iterable<SemesterReferences>): SemesterReferences {
  const total = { records: 0 };
  for (const ref of refs) {
    total.records += ref.records;
  }
  return total;
}

export function referencesBlockMessage(subject: string, refs: SemesterReferences): string {
  return `ลบถาวรไม่ได้ เพราะ${subject}ยังมีผลการเรียน ${refs.records} รายการ อ้างอิงอยู่`;
}

export function hasReferences(refs: SemesterReferences) {
  return refs.records > 0;
}

// The foreign keys are Restrict, so a row created between the count and the delete
// surfaces as P2003; report it the same way as the pre-check.
export async function conflictOnReferenced<T>(
  operation: Promise<T>,
  message: string,
): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw new ConflictException(message);
    }
    throw error;
  }
}
