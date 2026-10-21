import { Grade } from '@prisma/client';
import { isLetterGrade } from './grade-point.constant';
import { StudentCourseRecordService } from './student-course-record.service';

// summarizeBySemester only reads its argument, so the service needs no providers.
const service = Object.create(StudentCourseRecordService.prototype) as StudentCourseRecordService;

const record = (grade: Grade, term: 'FIRST' | 'SECOND' = 'FIRST') =>
  ({
    grade,
    semesterId: `S-${term}`,
    semester: { term, academicYear: { year: 2568 } },
  }) as never;

describe('isLetterGrade', () => {
  it('is true for A to F and false for W, I, S, U', () => {
    expect(['A', 'B_PLUS', 'B', 'C_PLUS', 'C', 'D_PLUS', 'D', 'F'].every((g) => isLetterGrade(g as Grade))).toBe(true);
    expect(['W', 'I', 'S', 'U'].some((g) => isLetterGrade(g as Grade))).toBe(false);
  });
});

describe('summarizeBySemester gradedCount', () => {
  it('counts only A to F: W and I leave the term, S and U stay in studentCount but not in gradedCount', () => {
    const records = [
      ...Array(3).fill(0).map(() => record('B')),
      ...Array(10).fill(0).map(() => record('W')),
      ...Array(2).fill(0).map(() => record('S')),
      record('I'),
    ];
    const [term] = service.summarizeBySemester(records);
    expect(term.gradedCount).toBe(3);
    expect(term.studentCount).toBe(5);
  });
});

describe('summarizeBySemester achievementPercent', () => {
  it('is over gradedCount, so S/U do not drag it down', () => {
    // 2 of the 4 letter grades reached B; the two S and one U are not in the base.
    const records = ['A', 'B', 'C', 'F', 'S', 'S', 'U'].map((g) => record(g as Grade));
    const [term] = service.summarizeBySemester(records);
    expect(term.gradedCount).toBe(4);
    expect(term.studentCount).toBe(7);
    expect(term.achievementPercent).toBe(50);
  });

  it('drops a term that has only S/U (no data), instead of showing 0%', () => {
    const records = [
      record('S', 'FIRST'),
      record('U', 'FIRST'),
      record('A', 'SECOND'),
      record('C', 'SECOND'),
    ];
    const terms = service.summarizeBySemester(records);
    expect(terms).toHaveLength(1);
    expect(terms[0]).toMatchObject({ semesterTerm: 'SECOND', achievementPercent: 50 });
  });

  it('a term of ordinary letter grades gives the same figure as before', () => {
    const records = ['A', 'B_PLUS', 'C', 'D'].map((g) => record(g as Grade));
    const [term] = service.summarizeBySemester(records);
    expect(term.achievementPercent).toBe(50);
    expect(term.studentCount).toBe(4);
  });
});
