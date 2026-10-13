import { Grade } from '@prisma/client';
import { gradeToScore } from '../academic-record/student-course-record/grade-point.constant';
import {
  CAREER_FIT_MIN_GRADED_COURSES,
  CAREER_FIT_RECOMMENDED_COURSES,
  CAREER_FIT_TOP_COURSES,
  careerFitLevel,
} from './career-fit.constant';
import { CareerFitEntryDto, CareerFitReportDto } from './career-fit-report.dto';

export interface CareerInput {
  id: string;
  name: string;
  sortOrder: number;
  courses: { weight: number; courseId: string; code: string; name: string }[];
}

const MSG_NO_CAREERS = 'หลักสูตรของท่านยังไม่มีข้อมูลสายอาชีพ';
const MSG_NO_GRADES = 'ยังไม่มีผลการเรียนสำหรับวิเคราะห์ความเหมาะสมกับสายอาชีพ';
const MSG_OK = 'วิเคราะห์ความเหมาะสมกับสายอาชีพจากผลการเรียนเรียบร้อยแล้ว';
const MSG_INSUFFICIENT = `มีผลการเรียนในสายนี้น้อยกว่า ${CAREER_FIT_MIN_GRADED_COURSES} วิชา จึงยังไม่สามารถประเมินได้`;

const round2 = (n: number) => Math.round(n * 100) / 100;

// Pure. `latestGrades` = latest attempt's grade per courseId (retakes already
// resolved by the caller). Courses whose grade has no score (S/W/I) count as
// not graded: excluded from the score and the coverage, never 0.
export function computeCareerFit(
  careers: CareerInput[],
  latestGrades: Map<string, Grade>,
): CareerFitReportDto {
  if (careers.length === 0) {
    return { status: 'NO_CAREERS', message: MSG_NO_CAREERS, careers: [] };
  }

  if ([...latestGrades.values()].every((g) => gradeToScore(g) === null)) {
    return { status: 'NO_GRADES', message: MSG_NO_GRADES, careers: [] };
  }

  const entries = careers.map((career) => {
    const scored: { c: CareerInput['courses'][number]; grade: Grade; score: number }[] = [];
    const notScored: CareerInput['courses'] = [];
    for (const c of career.courses) {
      const grade = latestGrades.get(c.courseId);
      const score = grade === undefined ? null : gradeToScore(grade);
      if (grade !== undefined && score !== null) scored.push({ c, grade, score });
      else notScored.push(c);
    }

    const total = career.courses.length;
    const insufficient = scored.length < CAREER_FIT_MIN_GRADED_COURSES;
    let score: number | null = null;
    if (!insufficient) {
      const weightSum = scored.reduce((s, x) => s + x.c.weight, 0);
      score = round2(scored.reduce((s, x) => s + x.c.weight * x.score, 0) / weightSum);
    }

    const entry: CareerFitEntryDto = {
      careerId: career.id,
      careerName: career.name,
      status: insufficient ? 'INSUFFICIENT_DATA' : 'OK',
      score,
      level: score === null ? null : careerFitLevel(score),
      coverage: total === 0 ? 0 : round2(scored.length / total),
      gradedCourseCount: scored.length,
      totalCourseCount: total,
      topCourses: [...scored]
        .sort((a, b) => b.score - a.score || a.c.code.localeCompare(b.c.code))
        .slice(0, CAREER_FIT_TOP_COURSES)
        .map((x) => ({ code: x.c.code, name: x.c.name, grade: x.grade })),
      recommendedCourses: [...notScored]
        .sort((a, b) => b.weight - a.weight || a.code.localeCompare(b.code))
        .slice(0, CAREER_FIT_RECOMMENDED_COURSES)
        .map((c) => ({ code: c.code, name: c.name })),
    };
    if (insufficient) entry.message = MSG_INSUFFICIENT;
    return { entry, sortOrder: career.sortOrder };
  });

  // Ties keep the career file order (sortOrder, then name) so output is stable.
  entries.sort((a, b) => {
    const ai = a.entry.status === 'INSUFFICIENT_DATA' ? 1 : 0;
    const bi = b.entry.status === 'INSUFFICIENT_DATA' ? 1 : 0;
    if (ai !== bi) return ai - bi;
    if (ai === 0 && a.entry.score !== b.entry.score) return b.entry.score! - a.entry.score!;
    return a.sortOrder - b.sortOrder || a.entry.careerName.localeCompare(b.entry.careerName);
  });

  return { status: 'OK', message: MSG_OK, careers: entries.map((e) => e.entry) };
}
