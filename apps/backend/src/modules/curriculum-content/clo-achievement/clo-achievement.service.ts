import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ACHIEVED_GRADES,
  isLetterGrade,
} from '../../academic-record/student-course-record/grade-point.constant';
import {
  LatestCourseAttempt,
  StudentCourseRecordService,
} from '../../academic-record/student-course-record/student-course-record.service';
import { CurriculumService } from '../../organization/curriculum/curriculum.service';
import { CourseService } from '../course/course.service';
import { CourseCloAchievementReport } from './clo-achievement-report.interface';

@Injectable()
export class CloAchievementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courseService: CourseService,
    private readonly curriculumService: CurriculumService,
    private readonly studentCourseRecordService: StudentCourseRecordService,
  ) {}

  // Deterministic, computed live on every call — same "never cached"
  // reasoning as GPA/Credit Checker (CONVENTIONS.md §6/§8).
  async calculateForCourse(courseId: string): Promise<CourseCloAchievementReport> {
    const course = await this.courseService.findActiveByIdOrThrow(courseId);
    const curriculum = await this.curriculumService.findActiveByIdOrThrow(
      course.curriculumId,
    );

    const clos = await this.prisma.clo.findMany({
      where: { courseId, isActive: true },
    });

    const latestByStudent =
      await this.studentCourseRecordService.getLatestAttemptsPerStudent(
        courseId,
      );

    const { totalStudents, achievedStudents, achievementPercent } =
      this.summarizeCourseAchievement(latestByStudent);

    // Every CLO of this course shares the same achievementPercent — the
    // schema has no CLO-specific grade breakdown (only one grade per
    // StudentCourseRecord, covering the whole course). See TODO.md
    // "Phase 8 — CLO Achievement" for the known limitation and what a
    // more granular design would require.
    return {
      courseId: course.id,
      totalStudents,
      achievedStudents,
      achievementPercent,
      achievementThreshold: curriculum.defaultAchievementThreshold,
      clos: clos.map((clo) => {
        const threshold =
          clo.achievementThreshold ?? curriculum.defaultAchievementThreshold;
        return {
          cloId: clo.id,
          code: clo.code,
          description: clo.description,
          threshold,
          isAchieved: achievementPercent !== null && achievementPercent >= threshold,
        };
      }),
    };
  }

  // Pure — the course-level achievement bar itself, extracted so
  // curriculum-wide callers can apply it to attempts they already fetched
  // in one batched query instead of calling calculateForCourse (and its
  // four queries) once per course. One definition of the bar, two fetch
  // strategies (CONVENTIONS.md §6).
  //
  // totalStudents counts letter grades only (A to F). W/I never completed
  // the course; S/U is a pass/fail scale that says nothing about reaching
  // the B bar, so an S must not read as "not achieved" and drag a course to
  // 0%. Same base as the per-term trend's gradedCount. A course with no
  // letter grade at all has no percent (null), never 0.
  summarizeCourseAchievement(
    latestByStudent: Map<string, LatestCourseAttempt>,
  ): {
    totalStudents: number;
    achievedStudents: number;
    // null = nobody has a final grade yet (no data) — never 0, which
    // would read as "everyone failed".
    achievementPercent: number | null;
  } {
    let totalStudents = 0;
    let achievedStudents = 0;
    for (const attempt of latestByStudent.values()) {
      if (!isLetterGrade(attempt.grade)) {
        continue;
      }
      totalStudents += 1;
      if (ACHIEVED_GRADES.has(attempt.grade)) {
        achievedStudents += 1;
      }
    }

    return {
      totalStudents,
      achievedStudents,
      achievementPercent:
        totalStudents > 0 ? (achievedStudents / totalStudents) * 100 : null,
    };
  }
}
