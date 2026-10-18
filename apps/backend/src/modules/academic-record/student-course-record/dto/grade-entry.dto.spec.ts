import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Grade } from '@prisma/client';
import { ENTRY_GRADES, GRADE_POINTS } from '../grade-point.constant';
import { CreateStudentCourseRecordDto } from './create-student-course-record.dto';
import { UpdateStudentCourseRecordDto } from './update-student-course-record.dto';

const UUID = 'a3f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d';

const create = (grade: string) =>
  validate(
    plainToInstance(CreateStudentCourseRecordDto, {
      studentProfileId: UUID,
      courseId: UUID,
      semesterId: UUID,
      grade,
    }),
  );
const update = (grade: string) =>
  validate(plainToInstance(UpdateStudentCourseRecordDto, { grade }));

describe('grade entry validation', () => {
  it('rejects S and U on create and update with a Thai message', async () => {
    for (const grade of ['S', 'U']) {
      for (const run of [create, update]) {
        const errors = await run(grade);
        expect(errors).toHaveLength(1);
        expect(Object.values(errors[0].constraints ?? {})[0]).toContain('ไม่รับเกรด S และ U');
      }
    }
  });

  it('still accepts every other grade, including W and I', async () => {
    const others = (Object.keys(GRADE_POINTS) as Grade[]).filter((g) => g !== 'S' && g !== 'U');
    expect(others).toHaveLength(10);
    for (const grade of others) {
      expect(await create(grade)).toHaveLength(0);
      expect(await update(grade)).toHaveLength(0);
    }
  });

  it('rejects unknown values', async () => {
    expect(await create('Z')).toHaveLength(1);
    expect(await update('')).toHaveLength(1);
  });

  it('keeps S and U in the enum and reading/calculation tables for existing rows', () => {
    expect(ENTRY_GRADES).not.toContain('S');
    expect(ENTRY_GRADES).not.toContain('U');
    expect('S' in GRADE_POINTS && 'U' in GRADE_POINTS).toBe(true);
    expect(GRADE_POINTS.S).toBeNull();
    expect(GRADE_POINTS.U).toBeNull();
  });
});
