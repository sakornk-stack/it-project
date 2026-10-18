import { GRADE_LABELS, GRADE_OPTIONS, gradeOptionsFor } from './grade-label';
import { courseRecordSchema } from './validation/course-record.schema';

const UUID = 'a3f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d';
const parse = (grade: string) =>
  courseRecordSchema.safeParse({ courseId: UUID, semesterId: UUID, grade });

describe('grade entry', () => {
  it('offers no S or U to pick, but every other grade', () => {
    expect(GRADE_OPTIONS).toEqual(['A', 'B_PLUS', 'B', 'C_PLUS', 'C', 'D_PLUS', 'D', 'F', 'W', 'I']);
  });

  it('keeps S/U labels so existing records still display', () => {
    expect(GRADE_LABELS.S).toBe('S');
    expect(GRADE_LABELS.U).toBe('U');
  });

  it('lists a stored S/U only for the record that holds it', () => {
    expect(gradeOptionsFor('S')).toEqual([...GRADE_OPTIONS, 'S']);
    expect(gradeOptionsFor('U')).toEqual([...GRADE_OPTIONS, 'U']);
    expect(gradeOptionsFor('A')).toEqual(GRADE_OPTIONS);
  });

  it('rejects S/U in the add-record schema and accepts the rest', () => {
    expect(parse('S').success).toBe(false);
    expect(parse('U').success).toBe(false);
    for (const g of GRADE_OPTIONS) expect(parse(g).success).toBe(true);
  });
});
