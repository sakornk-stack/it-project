import { Grade, SemesterTerm } from '@prisma/client';
import {
  LatestCourseAttempt,
  StudentCourseRecordService,
} from './student-course-record.service';

// dedupe* and calculateGpaFromAttempts are pure, so no collaborator is touched.
const service = new StudentCourseRecordService(
  {} as never,
  {} as never,
  {} as never,
  {} as never,
  {} as never,
);

function attempt(
  id: string,
  grade: Grade,
  year: number,
  term: SemesterTerm,
  overrides: Partial<LatestCourseAttempt> = {},
): LatestCourseAttempt {
  return {
    id,
    grade,
    credits: 3,
    courseId: 'c1',
    studentProfileId: 's1',
    semesterId: `${year}-${term}`,
    isActive: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    semester: { term, academicYear: { year } },
    ...overrides,
  } as unknown as LatestCourseAttempt;
}

const pickCourse = (records: LatestCourseAttempt[]) =>
  service.dedupeLatestPerCourse(records).get('c1');
const pickStudent = (records: LatestCourseAttempt[]) =>
  service.dedupeLatestPerStudent(records).get('s1');

describe.each([
  ['dedupeLatestPerCourse', pickCourse],
  ['dedupeLatestPerStudent', pickStudent],
])('%s — retake policy', (_name, pick) => {
  it('keeps the later attempt for an ordinary retake (F then B)', () => {
    const result = pick([attempt('a', 'F', 2565, 'FIRST'), attempt('b', 'B', 2565, 'SECOND')]);
    expect(result?.grade).toBe('B');
  });

  it('keeps an earlier PASS when the latest attempt is a W', () => {
    const records = [attempt('a', 'B', 2565, 'FIRST'), attempt('b', 'W', 2566, 'FIRST')];
    expect(pick(records)?.grade).toBe('B');
    expect(pick([...records].reverse())?.grade).toBe('B');
  });

  it('keeps an earlier F when the latest attempt is a W, even after several W', () => {
    const records = [
      attempt('a', 'F', 2565, 'FIRST'),
      attempt('b', 'W', 2566, 'FIRST'),
      attempt('c', 'W', 2566, 'SECOND'),
    ];
    expect(pick(records)?.grade).toBe('F');
  });

  it('treats an I after an F like a W', () => {
    expect(pick([attempt('a', 'F', 2565, 'FIRST'), attempt('b', 'I', 2566, 'FIRST')])?.grade).toBe('F');
  });

  it('still returns the W when it is the only attempt', () => {
    expect(pick([attempt('a', 'W', 2565, 'FIRST')])?.grade).toBe('W');
  });

  it('returns the later W when there are only excluded attempts', () => {
    const result = pick([attempt('a', 'W', 2565, 'FIRST'), attempt('b', 'I', 2566, 'FIRST')]);
    expect(result?.id).toBe('b');
  });

  it('lets a real grade replace an earlier W', () => {
    expect(pick([attempt('a', 'W', 2565, 'FIRST'), attempt('b', 'C', 2566, 'FIRST')])?.grade).toBe('C');
  });

  it('does not treat U as excluded: a later U replaces an earlier PASS', () => {
    expect(pick([attempt('a', 'B', 2565, 'FIRST'), attempt('b', 'U', 2566, 'FIRST')])?.grade).toBe('U');
  });

  it('settles the same (year, term) by updatedAt, then createdAt, then id, whatever the input order', () => {
    const older = attempt('a', 'D', 2565, 'FIRST', {
      updatedAt: new Date('2025-02-01T00:00:00Z'),
    });
    const newer = attempt('b', 'C', 2565, 'FIRST', {
      updatedAt: new Date('2025-03-01T00:00:00Z'),
    });
    expect(pick([older, newer])?.id).toBe('b');
    expect(pick([newer, older])?.id).toBe('b');

    const sameTimes = [attempt('x', 'D', 2565, 'FIRST'), attempt('y', 'C', 2565, 'FIRST')];
    expect(pick(sameTimes)?.id).toBe('y');
    expect(pick([...sameTimes].reverse())?.id).toBe('y');

    const byCreated = [
      attempt('p', 'D', 2565, 'FIRST', { createdAt: new Date('2025-01-02T00:00:00Z') }),
      attempt('q', 'C', 2565, 'FIRST'),
    ];
    expect(pick(byCreated)?.id).toBe('p');
    expect(pick([...byCreated].reverse())?.id).toBe('p');
  });
});

describe('calculateGpaFromAttempts with a W after another grade', () => {
  it('counts a surviving F as 0.0 in the cumulative GPA', () => {
    const latest = service.dedupeLatestPerCourse([
      attempt('a', 'F', 2565, 'FIRST'),
      attempt('b', 'W', 2566, 'FIRST'),
      attempt('c', 'A', 2565, 'FIRST', { courseId: 'c2' }),
    ]);
    const gpa = service.calculateGpaFromAttempts(latest);
    expect(gpa.creditsCounted).toBe(6);
    expect(gpa.gpa).toBeCloseTo(2.0);
  });
});
