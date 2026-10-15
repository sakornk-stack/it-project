import { StudentCourseRecordService } from './student-course-record.service';

// groupCoursesByYearAndSemester is pure, so no collaborator is touched.
const service = new StudentCourseRecordService(
  {} as never,
  {} as never,
  {} as never,
  {} as never,
  {} as never,
);

function rec(
  studentProfileId: string,
  year: number,
  term: 'FIRST' | 'SECOND',
  courseId = 'c1',
) {
  return {
    grade: 'B',
    courseId,
    studentProfileId,
    semesterId: `${year}-${term}`,
    semester: { term, academicYear: { year } },
    studentProfile: { admissionYear: 2565 },
    course: {
      code: courseId,
      name: courseId,
      curriculum: { effectiveYear: 2560, program: { code: 'P' } },
    },
  } as never;
}

describe('groupCoursesByYearAndSemester — totalStudentCount', () => {
  it('counts distinct students across terms, per course, beside the per-term count', () => {
    const years = service.groupCoursesByYearAndSemester([
      rec('s1', 2568, 'FIRST'),
      rec('s2', 2568, 'FIRST'),
      rec('s1', 2569, 'FIRST'), // same student again in a later term
      rec('s3', 2569, 'FIRST'),
      rec('s9', 2569, 'FIRST', 'c2'),
    ]);
    const cells = years.flatMap((y) => y.semesters.flatMap((s) => s.courses));
    const c1 = cells.filter((c) => c.courseId === 'c1');
    expect(c1.map((c) => c.studentCount).sort()).toEqual([2, 2]);
    expect(c1.every((c) => c.totalStudentCount === 3)).toBe(true);
    expect(cells.find((c) => c.courseId === 'c2')?.totalStudentCount).toBe(1);
  });
});
