import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Grade, Prisma, Role, SemesterTerm } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestUser } from '../../auth/request-user.interface';
import { CourseService } from '../../curriculum-content/course/course.service';
import { StudentProfileService } from '../../users/student-profile/student-profile.service';
import { ScopeResolverService } from '../../../common/scope/scope-resolver.service';
import { SemesterService } from '../semester/semester.service';
import { CreateStudentCourseRecordDto } from './dto/create-student-course-record.dto';
import { resolveYearLevel } from '../../../common/academic/year-level';
import { UpdateStudentCourseRecordDto } from './dto/update-student-course-record.dto';
import {
  ACHIEVED_GRADES,
  AT_RISK_GRADES,
  GRADE_POINTS,
  GRADE_STATUS,
  isLetterGrade,
  RiskLevel,
  SEMESTER_TERM_RANK,
  riskLevel,
} from './grade-point.constant';

// Colocated with the service that produces it — no separate types file
// exists yet in this module.
export type LatestCourseAttempt = Prisma.StudentCourseRecordGetPayload<{
  include: { semester: { include: { academicYear: true } } };
}>;

// Sibling of LatestCourseAttempt with the extra joins the instructor
// course-timeline needs (admissionYear for year-level, course code/name
// plus curriculum/program for the "which curriculum is this" label — a
// course's code is only unique WITHIN one curriculum, so two different
// curricula can have their own course row with the same code) — kept
// separate so findActiveRecordsForCourse(s)'s existing callers don't pay
// for joins they don't use.
export type LatestCourseAttemptWithProfile = Prisma.StudentCourseRecordGetPayload<{
  include: {
    semester: { include: { academicYear: true } };
    studentProfile: true;
    course: { include: { curriculum: { include: { program: true } } } };
  };
}>;

export interface StudentRosterEntry {
  studentProfileId: string;
  // The specific latest-attempt record id — additive field (Phase 2.1
  // assessment-evidence UI) so the roster can double as the row source
  // for StudentAssessmentScore upserts, which key off the attempt, not
  // just the student. Computed for free from the same latestAttempts Map
  // this method already builds — no extra query.
  studentCourseRecordId: string;
  studentCode: string;
  fullName: string;
  grade: Grade;
  // Severity band of `grade`, so the gradebook can filter by it without
  // reimplementing the AT_RISK_GRADES split client-side.
  riskLevel: RiskLevel;
}

export interface GpaSummary {
  gpa: number | null;
  creditsCounted: number;
  courseCount: number;
}

export interface SemesterGpa extends GpaSummary {
  semesterId: string;
  academicYear: number;
  semesterTerm: SemesterTerm;
}

export interface GpaResult extends GpaSummary {
  // Per-semester breakdown — grouped from RAW records (not the
  // retake-deduped latest-attempt map used for the cumulative gpa above),
  // since a semester's own GPA must reflect what was actually graded that
  // semester, including a course later retaken elsewhere. See the
  // Timeline redesign plan note on why this can't reuse
  // getLatestAttemptsPerCourse.
  bySemester: SemesterGpa[];
}

export interface SemesterAchievement {
  academicYear: number;
  semesterTerm: SemesterTerm;
  studentCount: number; // excludes W/I, same base as CloAchievementService
  gradedCount: number; // A to F only (no W/I/S/U): the base for sample-size notes
  achievementPercent: number; // % graded B or above
}

// groupCoursesByYearAndSemester's return shape — Academic Year -> Semester
// -> Course, for the instructor "My Courses" timeline view.
export interface InstructorCourseTimelineCourse {
  courseId: string;
  code: string;
  name: string;
  // A course's code is only unique WITHIN one curriculum, so the same
  // code can appear under two different curricula — these two fields let
  // the UI label which one this row is, instead of assuming a code alone
  // identifies a subject.
  programCode: string;
  curriculumYear: number;
  studentCount: number; // everyone enrolled, unlike SemesterAchievement (no W/I exclusion)
  gradedCount: number; // of those, A to F only (no W/I/S/U)
  predominantYearLevel: number; // 1-4, mode across this group's students
}

export interface InstructorCourseTimelineSemester {
  semesterId: string;
  semesterTerm: SemesterTerm;
  courses: InstructorCourseTimelineCourse[];
}

export interface InstructorCourseTimelineYear {
  academicYear: number;
  semesters: InstructorCourseTimelineSemester[];
}

export interface StudentInstructorTimelineEntry {
  courseId: string;
  code: string;
  name: string;
  grade: Grade;
  academicYear: number;
  semesterTerm: SemesterTerm;
}

export interface StudentInstructorTimeline {
  studentProfileId: string;
  studentCode: string;
  fullName: string;
  // Only courses the requesting instructor teaches — never the student's
  // full transcript. See getStudentTimelineWithInstructor.
  entries: StudentInstructorTimelineEntry[];
}

@Injectable()
export class StudentCourseRecordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentProfileService: StudentProfileService,
    private readonly courseService: CourseService,
    private readonly semesterService: SemesterService,
    private readonly scopeResolverService: ScopeResolverService,
  ) {}

  async create(dto: CreateStudentCourseRecordDto, user: RequestUser) {
    const profile = await this.resolveOwnStudentProfileOrValidate(
      dto.studentProfileId,
      user,
    );
    const studentProfileId = profile.id;

    const course = await this.courseService.findActiveByIdOrThrow(dto.courseId);
    // The staff scope check above only covers the student; without this a
    // STAFF could file a course from any other curriculum under them.
    if (course.curriculumId !== profile.curriculumId) {
      throw new BadRequestException(
        'วิชานี้ไม่อยู่ในหลักสูตรของนักศึกษา จึงเพิ่มผลการเรียนไม่ได้',
      );
    }
    await this.semesterService.findActiveByIdOrThrow(dto.semesterId);

    try {
      return await this.prisma.studentCourseRecord.create({
        data: {
          studentProfileId,
          courseId: dto.courseId,
          semesterId: dto.semesterId,
          grade: dto.grade,
          // Snapshot, not a live join — see schema.prisma comment on
          // StudentCourseRecord.credits.
          credits: course.credits,
          enteredByUserId: user.userId,
          enteredByRole: this.resolveActingRole(user),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `A record for course ${dto.courseId} in semester ${dto.semesterId} already exists for this student`,
        );
      }
      throw error;
    }
  }

  // Per CONVENTIONS.md §3a: STUDENT sees only their own rows, filtered at
  // the query level — never fetched in full and filtered in memory.
  // ADMIN/STAFF (§10): scoped to students in programs their scope covers,
  // same query-level discipline via getCoveredProgramIds.
  async findAll(user: RequestUser) {
    // Chronological, not insert-order — without this, Postgres has no
    // guaranteed row order and a plain refetch can silently reshuffle a
    // transcript. Same term ranking as SEMESTER_TERM_RANK below (the
    // SemesterTerm enum is declared FIRST/SECOND/SUMMER in schema.prisma,
    // so Postgres's native enum ordinal already sorts correctly here).
    const orderBy: Prisma.StudentCourseRecordOrderByWithRelationInput[] = [
      { semester: { academicYear: { year: 'asc' } } },
      { semester: { term: 'asc' } },
      { course: { code: 'asc' } },
    ];

    if (this.isSelfServiceOnly(user)) {
      const own = await this.studentProfileService.findByUserId(user.userId);
      return this.prisma.studentCourseRecord.findMany({
        where: { studentProfileId: own.id, isActive: true },
        orderBy,
      });
    }
    if (this.isStaffTier(user)) {
      const programIds = await this.scopeResolverService.getCoveredProgramIds(
        user.userId,
      );
      return this.prisma.studentCourseRecord.findMany({
        where: {
          studentProfile: { programId: { in: programIds } },
          isActive: true,
        },
        orderBy,
      });
    }
    return this.prisma.studentCourseRecord.findMany({
      where: { isActive: true },
      orderBy,
    });
  }

  async findOne(id: string, user: RequestUser) {
    const where: Prisma.StudentCourseRecordWhereInput = { id, isActive: true };
    if (this.isSelfServiceOnly(user)) {
      const own = await this.studentProfileService.findByUserId(user.userId);
      where.studentProfileId = own.id;
    }

    const record = await this.prisma.studentCourseRecord.findFirst({ where });
    if (!record) {
      // Same exception for "doesn't exist" and "exists but isn't yours" —
      // see CONVENTIONS.md §3a on avoiding a 403 information leak.
      throw new NotFoundException(`Student course record ${id} not found`);
    }
    if (this.isStaffTier(user)) {
      // Distinct from the 404 above — this is a staff role hitting its
      // scope boundary, not a STUDENT peer probing another student's
      // data, so ScopeGuard's usual 403 convention applies here instead.
      await this.assertStaffScopeCovers(record.studentProfileId, user);
    }
    if (this.isInstructorTier(user)) {
      await this.assertInstructorAssigned(record.courseId, user);
    }
    return record;
  }

  async update(id: string, dto: UpdateStudentCourseRecordDto, user: RequestUser) {
    await this.findOne(id, user);
    return this.prisma.studentCourseRecord.update({
      where: { id },
      data: {
        ...dto,
        // Last-writer, not first: overwritten on every update, so this
        // always answers "who is responsible for the current grade value"
        // — see schema.prisma comment on enteredByUserId.
        enteredByUserId: user.userId,
        enteredByRole: this.resolveActingRole(user),
      },
    });
  }

  // STUDENT deleting their own mis-entered row, or SUPER_ADMIN: hard
  // delete, unchanged (PROJECT_CONTEXT.md §16's original framing still
  // holds for self-correction). ADMIN/STAFF/INSTRUCTOR deleting a record
  // that isn't theirs: soft delete — higher risk than correcting your own
  // row, so it stays recoverable/auditable rather than gone outright.
  async remove(id: string, user: RequestUser) {
    await this.findOne(id, user);
    if (this.isStaffTier(user) || this.isInstructorTier(user)) {
      return this.prisma.studentCourseRecord.update({
        where: { id },
        data: { isActive: false },
      });
    }
    return this.prisma.studentCourseRecord.delete({ where: { id } });
  }

  // Deterministic, computed live on every call (never cached) — per
  // CONVENTIONS.md §6 and the same "always resolve live" reasoning as
  // §8's scope resolution rule: a cached GPA would need invalidation on
  // every grade write, which is a failure mode this avoids entirely.
  async calculateGpa(
    studentProfileId: string,
    user: RequestUser,
  ): Promise<GpaResult> {
    await this.assertGpaAccess(studentProfileId, user);

    const latestByCourse = await this.getLatestAttemptsPerCourse(studentProfileId);
    const cumulative = this.calculateGpaFromAttempts(latestByCourse);
    const bySemester = await this.calculateGpaBySemester(studentProfileId);

    return { ...cumulative, bySemester };
  }

  // Shared by calculateGpa/calculateGpaBySemester — same self-vs-staff
  // ownership rule, extracted so it isn't duplicated across both.
  private async assertGpaAccess(studentProfileId: string, user: RequestUser) {
    if (this.isSelfServiceOnly(user)) {
      const own = await this.studentProfileService.findByUserId(user.userId);
      if (own.id !== studentProfileId) {
        throw new NotFoundException(
          `Student profile ${studentProfileId} not found`,
        );
      }
    } else {
      await this.studentProfileService.findActiveByIdOrThrow(studentProfileId);
      if (this.isStaffTier(user)) {
        await this.assertStaffScopeCovers(studentProfileId, user);
      }
    }
  }

  // Pure/internal — no I/O, no ownership check, takes already-fetched
  // data. Extracted so CohortAnalytics-style callers (Phase 9 Chunk 3+)
  // can reuse the exact same GPA math on a Map they already fetched for
  // PLO scoring too, instead of querying twice per student.
  calculateGpaFromAttempts(
    latestByCourse: Map<string, LatestCourseAttempt>,
  ): GpaSummary {
    return this.summarizeGpa(Array.from(latestByCourse.values()));
  }

  // Per-semester GPA — deliberately does NOT go through
  // getLatestAttemptsPerCourse's retake dedup (that map only keeps the
  // most recent attempt of each course across the WHOLE transcript, so a
  // course later retaken would silently disappear from the semester it
  // was first attempted in). Groups raw active records by semesterId
  // instead — each semester's GPA reflects exactly what was graded that
  // semester.
  private async calculateGpaBySemester(
    studentProfileId: string,
  ): Promise<SemesterGpa[]> {
    const records = await this.prisma.studentCourseRecord.findMany({
      where: { studentProfileId, isActive: true },
      include: { semester: { include: { academicYear: true } } },
    });

    const bySemesterId = new Map<
      string,
      {
        academicYear: number;
        semesterTerm: SemesterTerm;
        records: { grade: Grade; credits: number }[];
      }
    >();
    for (const record of records) {
      const group = bySemesterId.get(record.semesterId) ?? {
        academicYear: record.semester.academicYear.year,
        semesterTerm: record.semester.term,
        records: [],
      };
      group.records.push(record);
      bySemesterId.set(record.semesterId, group);
    }

    return Array.from(bySemesterId.entries()).map(([semesterId, group]) => ({
      semesterId,
      academicYear: group.academicYear,
      semesterTerm: group.semesterTerm,
      ...this.summarizeGpa(group.records),
    }));
  }

  // Pure/internal — the weighted-average math shared by the cumulative
  // (retake-deduped) and per-semester (raw) GPA calculations above; only
  // the input array differs between the two callers.
  private summarizeGpa(
    records: { grade: Grade; credits: number }[],
  ): GpaSummary {
    let gradePointSum = 0;
    let creditsCounted = 0;
    for (const record of records) {
      const gradePoint = GRADE_POINTS[record.grade];
      if (gradePoint === null) {
        continue; // W/I/S/U — excluded from both numerator and denominator
      }
      gradePointSum += gradePoint * record.credits;
      creditsCounted += record.credits;
    }

    return {
      gpa: creditsCounted > 0 ? gradePointSum / creditsCounted : null,
      creditsCounted,
      courseCount: records.length,
    };
  }

  // Pure/internal — same shape as calculateGpaFromAttempts above, operates
  // on an already-fetched Map. Full distribution over all 12 Grade values
  // (including W/I/S/U) — a raw tally, not pre-filtered like
  // CloAchievementService's own PASS/FAIL-only totalStudents.
  tallyGradeDistribution(
    latestAttempts: Map<string, LatestCourseAttempt>,
  ): Record<Grade, number> {
    const distribution = Object.fromEntries(
      Object.keys(GRADE_POINTS).map((grade) => [grade, 0]),
    ) as Record<Grade, number>;
    for (const record of latestAttempts.values()) {
      distribution[record.grade] += 1;
    }
    return distribution;
  }

  // Pure — worst grade first; U has no grade point, ranked with F.
  selectAtRiskAttempts(
    latestAttempts: Map<string, LatestCourseAttempt>,
  ): LatestCourseAttempt[] {
    return [...latestAttempts.values()]
      .filter((attempt) => AT_RISK_GRADES.has(attempt.grade))
      .sort(
        (a, b) => (GRADE_POINTS[a.grade] ?? 0) - (GRADE_POINTS[b.grade] ?? 0),
      );
  }

  // Retake policy (confirmed in Phase 6): the latest attempt replaces
  // earlier ones — group by courseId, keep only the record from the most
  // recent (academicYear.year, term) per course. Shared by calculateGpa
  // and CreditCheckerService (per CONVENTIONS.md §6, never reimplemented
  // at a second call site). No ownership check here — the caller must
  // have already validated studentProfileId belongs to the requester.
  async getLatestAttemptsPerCourse(
    studentProfileId: string,
  ): Promise<Map<string, LatestCourseAttempt>> {
    const records = await this.prisma.studentCourseRecord.findMany({
      where: { studentProfileId, isActive: true },
      include: { semester: { include: { academicYear: true } } },
    });
    return this.dedupeLatestPerCourse(records);
  }

  // Pure — extracted out of getLatestAttemptsPerCourse for the same reason
  // dedupeLatestPerStudent was extracted below: getStaffOverview fetches
  // every in-scope student's records in ONE query, then needs the retake
  // policy applied per student without a round trip each. Same policy, one
  // implementation (CONVENTIONS.md §6).
  dedupeLatestPerCourse(
    records: LatestCourseAttempt[],
  ): Map<string, LatestCourseAttempt> {
    const latestByCourse = new Map<string, LatestCourseAttempt>();
    for (const record of records) {
      const existing = latestByCourse.get(record.courseId);
      if (!existing || this.isPreferredAttempt(record, existing)) {
        latestByCourse.set(record.courseId, record);
      }
    }
    return latestByCourse;
  }

  // Batched sibling of the per-student query above — one round trip for a
  // whole cohort. Callers group by studentProfileId themselves and run
  // dedupeLatestPerCourse on each group.
  async findActiveRecordsForStudents(
    studentProfileIds: string[],
  ): Promise<LatestCourseAttempt[]> {
    if (studentProfileIds.length === 0) return [];
    return this.prisma.studentCourseRecord.findMany({
      where: { studentProfileId: { in: studentProfileIds }, isActive: true },
      include: { semester: { include: { academicYear: true } } },
    });
  }

  // Mirror of getLatestAttemptsPerCourse, grouped the other direction —
  // per student instead of per course — for CloAchievementService, which
  // needs every student's latest attempt of ONE course rather than one
  // student's latest attempt of every course. Same retake policy, same
  // isLaterAttempt logic reused. No ownership check here either — this
  // is a Course-scoped aggregate read, not a student-scoped one.
  async getLatestAttemptsPerStudent(
    courseId: string,
  ): Promise<Map<string, LatestCourseAttempt>> {
    const records = await this.findActiveRecordsForCourse(courseId);
    return this.dedupeLatestPerStudent(records);
  }

  // Raw (non-deduped) active records for a course — shared by
  // dedupeLatestPerStudent and summarizeBySemester below, so
  // getInstructorDashboard's per-course achievement trend costs no extra
  // query beyond what it already fetches for grade distribution.
  async findActiveRecordsForCourse(
    courseId: string,
  ): Promise<LatestCourseAttempt[]> {
    return this.prisma.studentCourseRecord.findMany({
      where: { courseId, isActive: true },
      include: { semester: { include: { academicYear: true } } },
    });
  }

  // Batched sibling of findActiveRecordsForCourse, mirroring what
  // findActiveRecordsForStudents does for the other grouping direction —
  // one round trip for every course in a curriculum (or in the whole
  // system) instead of one per course. Callers group by courseId
  // themselves and run dedupeLatestPerStudent on each group.
  async findActiveRecordsForCourses(
    courseIds: string[],
  ): Promise<LatestCourseAttempt[]> {
    if (courseIds.length === 0) return [];
    return this.prisma.studentCourseRecord.findMany({
      where: { courseId: { in: courseIds }, isActive: true },
      include: { semester: { include: { academicYear: true } } },
    });
  }

  // Sibling of findActiveRecordsForCourses with the extra joins the
  // instructor course-timeline needs — kept separate rather than widening
  // findActiveRecordsForCourses's include, since that method's other
  // callers (dashboard.service.ts's other reports, plo-achievement.service.ts)
  // don't want the added studentProfile/course joins.
  async findActiveRecordsForCoursesWithStudentProfile(
    courseIds: string[],
  ): Promise<LatestCourseAttemptWithProfile[]> {
    if (courseIds.length === 0) return [];
    return this.prisma.studentCourseRecord.findMany({
      where: { courseId: { in: courseIds }, isActive: true },
      include: {
        semester: { include: { academicYear: true } },
        studentProfile: true,
        course: { include: { curriculum: { include: { program: true } } } },
      },
    });
  }

  // Pure — extracted out of getLatestAttemptsPerStudent so
  // getInstructorDashboard can fetch findActiveRecordsForCourse once and
  // derive both the deduped map (grade distribution, at-risk) and
  // summarizeBySemester's raw grouping from the same records.
  dedupeLatestPerStudent(
    records: LatestCourseAttempt[],
  ): Map<string, LatestCourseAttempt> {
    const latestByStudent = new Map<string, LatestCourseAttempt>();
    for (const record of records) {
      const existing = latestByStudent.get(record.studentProfileId);
      if (!existing || this.isPreferredAttempt(record, existing)) {
        latestByStudent.set(record.studentProfileId, record);
      }
    }
    return latestByStudent;
  }

  // Pure — per-semester achievement %, same B-or-above bar and W/I
  // exclusion as CloAchievementService.calculateForCourse, but grouped by
  // semester instead of collapsed to one course-wide number. Groups RAW
  // records (not retake-deduped) for the same reason calculateGpaBySemester
  // does: a course retaken in a later semester must still count in the
  // semester it was originally attempted. A semester left with 0 students
  // after excluding W/I is dropped entirely, not emitted as a fake 0%.
  summarizeBySemester(records: LatestCourseAttempt[]): SemesterAchievement[] {
    const bySemesterId = new Map<string, LatestCourseAttempt[]>();
    for (const record of records) {
      if (GRADE_STATUS[record.grade] === 'EXCLUDED') continue;
      const group = bySemesterId.get(record.semesterId) ?? [];
      group.push(record);
      bySemesterId.set(record.semesterId, group);
    }

    return Array.from(bySemesterId.values())
      .filter((group) => group.length > 0)
      .map((group) => {
        const achieved = group.filter((r) => ACHIEVED_GRADES.has(r.grade)).length;
        return {
          academicYear: group[0].semester.academicYear.year,
          semesterTerm: group[0].semester.term,
          studentCount: group.length,
          gradedCount: group.filter((r) => isLetterGrade(r.grade)).length,
          achievementPercent: (achieved / group.length) * 100,
        };
      })
      .sort((a, b) => {
        if (a.academicYear !== b.academicYear) return a.academicYear - b.academicYear;
        return SEMESTER_TERM_RANK[a.semesterTerm] - SEMESTER_TERM_RANK[b.semesterTerm];
      });
  }

  // Pure — one level deeper than summarizeBySemester (which groups one
  // course's records by semester for a trend chart). This groups an
  // instructor's records across ALL their courses by
  // (academicYear, semesterId, courseId) for the "My Courses" timeline
  // view. Unlike summarizeBySemester, does NOT exclude W/I — studentCount
  // here means "enrolled this term", not an achievement metric, so every
  // active record counts toward it and toward the year-level mode.
  groupCoursesByYearAndSemester(
    records: LatestCourseAttemptWithProfile[],
  ): InstructorCourseTimelineYear[] {
    const cells = new Map<string, LatestCourseAttemptWithProfile[]>();
    for (const record of records) {
      const key = `${record.semester.academicYear.year}::${record.semesterId}::${record.courseId}`;
      const group = cells.get(key) ?? [];
      group.push(record);
      cells.set(key, group);
    }

    const courseRows = Array.from(cells.values()).map((group) => {
      const first = group[0];
      const yearLevels = group.map((r) =>
        this.resolveYearLevelAt(first.semester.academicYear.year, r.studentProfile.admissionYear),
      );
      return {
        academicYear: first.semester.academicYear.year,
        semesterId: first.semesterId,
        semesterTerm: first.semester.term,
        courseId: first.courseId,
        code: first.course.code,
        name: first.course.name,
        programCode: first.course.curriculum.program.code,
        curriculumYear: first.course.curriculum.effectiveYear,
        studentCount: group.length,
        gradedCount: group.filter((r) => isLetterGrade(r.grade)).length,
        predominantYearLevel: this.modeOf(yearLevels),
      };
    });

    const byYear = new Map<number, Map<string, InstructorCourseTimelineCourse[]>>();
    const semesterTermByYearSemester = new Map<string, SemesterTerm>();
    for (const row of courseRows) {
      const semesters = byYear.get(row.academicYear) ?? new Map<string, InstructorCourseTimelineCourse[]>();
      const courses = semesters.get(row.semesterId) ?? [];
      courses.push({
        courseId: row.courseId,
        code: row.code,
        name: row.name,
        programCode: row.programCode,
        curriculumYear: row.curriculumYear,
        studentCount: row.studentCount,
        gradedCount: row.gradedCount,
        predominantYearLevel: row.predominantYearLevel,
      });
      semesters.set(row.semesterId, courses);
      byYear.set(row.academicYear, semesters);
      semesterTermByYearSemester.set(row.semesterId, row.semesterTerm);
    }

    return Array.from(byYear.entries())
      .sort(([a], [b]) => b - a) // academicYear DESC — current term first
      .map(([academicYear, semesters]) => ({
        academicYear,
        semesters: Array.from(semesters.entries())
          .sort(
            ([semesterIdA], [semesterIdB]) =>
              SEMESTER_TERM_RANK[semesterTermByYearSemester.get(semesterIdA)!] -
              SEMESTER_TERM_RANK[semesterTermByYearSemester.get(semesterIdB)!],
          )
          .map(([semesterId, courses]) => ({
            semesterId,
            semesterTerm: semesterTermByYearSemester.get(semesterId)!,
            courses: courses.sort((a, b) => a.code.localeCompare(b.code)),
          })),
      }));
  }

  // Same clamp formula as DashboardService's bucketByYearLevel, just
  // parameterized by the GROUP's own academic year instead of always
  // "current" — a course-semester cell from three years ago should bucket
  // students by what year-level they were THEN, not now.
  private resolveYearLevelAt(academicYearOfSemester: number, admissionYear: number): number {
    return resolveYearLevel(academicYearOfSemester, admissionYear);
  }

  // Ties broken by smallest yearLevel first — deterministic, and a more
  // natural default than Map insertion order ("earlier in the program"
  // reads better as a tie-break than an arbitrary one).
  private modeOf(values: number[]): number {
    const counts = new Map<number, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    let best = values[0];
    let bestCount = 0;
    for (const [value, count] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
      if (count > bestCount) {
        best = value;
        bestCount = count;
      }
    }
    return best;
  }

  // §9: INSTRUCTOR can view "Student ที่เกี่ยวข้องกับ Course ที่ตัวเองรับผิดชอบ".
  // Reuses getLatestAttemptsPerStudent (same Map already powering Grade
  // Distribution) — no duplicate retake-collapsing logic. Minimal fields
  // only (no email/contact info) — an instructor needs to identify and
  // grade students, not contact them outside the platform.
  async getStudentRosterForCourse(
    courseId: string,
  ): Promise<StudentRosterEntry[]> {
    await this.courseService.findActiveByIdOrThrow(courseId);
    const latestAttempts = await this.getLatestAttemptsPerStudent(courseId);

    const profiles = await this.prisma.studentProfile.findMany({
      where: { id: { in: [...latestAttempts.keys()] } },
      include: { user: { select: { fullName: true } } },
    });
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    return [...latestAttempts.entries()]
      .map(([studentProfileId, attempt]) => {
        const profile = profileById.get(studentProfileId)!;
        return {
          studentProfileId,
          studentCourseRecordId: attempt.id,
          studentCode: profile.studentCode,
          fullName: profile.user.fullName,
          grade: attempt.grade,
          riskLevel: riskLevel(attempt.grade),
        };
      })
      .sort((a, b) => a.studentCode.localeCompare(b.studentCode));
  }

  // "This student, as seen by me" — never the student's full transcript.
  // instructorUserId's course list is derived here from CourseInstructor,
  // never taken from the caller (the controller's :courseId param only
  // gates *whether* to call this at all, via InstructorOrScopeGuard — it
  // is never passed in), so no combination of route params can widen the
  // result past what this instructor actually teaches.
  async getStudentTimelineWithInstructor(
    studentProfileId: string,
    instructorUserId: string,
  ): Promise<StudentInstructorTimeline> {
    const profile = await this.studentProfileService.findActiveByIdOrThrow(
      studentProfileId,
    );

    const myCourses = await this.courseService.findMyCourses(instructorUserId);
    const myCourseIds = myCourses.map((c) => c.id);

    const records =
      myCourseIds.length === 0
        ? []
        : await this.prisma.studentCourseRecord.findMany({
            where: {
              studentProfileId,
              isActive: true,
              courseId: { in: myCourseIds },
            },
            include: {
              course: { select: { id: true, code: true, name: true } },
              semester: { include: { academicYear: true } },
            },
          });

    const entries = records
      .map((record) => ({
        courseId: record.course.id,
        code: record.course.code,
        name: record.course.name,
        grade: record.grade,
        academicYear: record.semester.academicYear.year,
        semesterTerm: record.semester.term,
      }))
      .sort((a, b) => {
        if (a.academicYear !== b.academicYear) return a.academicYear - b.academicYear;
        return SEMESTER_TERM_RANK[a.semesterTerm] - SEMESTER_TERM_RANK[b.semesterTerm];
      });

    return {
      studentProfileId,
      studentCode: profile.studentCode,
      fullName: profile.user.fullName,
      entries,
    };
  }

  // Which of two attempts at the same course stands as "the" attempt. A W/I
  // (EXCLUDED) never replaces an attempt that has a real outcome, even a later
  // one: withdrawing from a retake must not erase the earlier pass or fail.
  // Otherwise the later (year, term) wins; the same (year, term) — which the
  // partial unique index on active records already rules out — is settled by
  // updatedAt, createdAt, then id, so the result never depends on query order.
  private isPreferredAttempt(
    candidate: LatestCourseAttempt,
    current: LatestCourseAttempt,
  ): boolean {
    const candidateExcluded = GRADE_STATUS[candidate.grade] === 'EXCLUDED';
    const currentExcluded = GRADE_STATUS[current.grade] === 'EXCLUDED';
    if (candidateExcluded !== currentExcluded) return currentExcluded;

    if (this.isLaterAttempt(candidate, current)) return true;
    if (this.isLaterAttempt(current, candidate)) return false;

    const byUpdated = candidate.updatedAt.getTime() - current.updatedAt.getTime();
    if (byUpdated !== 0) return byUpdated > 0;
    const byCreated = candidate.createdAt.getTime() - current.createdAt.getTime();
    if (byCreated !== 0) return byCreated > 0;
    return candidate.id > current.id;
  }

  private isLaterAttempt(
    candidate: { semester: { term: keyof typeof SEMESTER_TERM_RANK; academicYear: { year: number } } },
    current: { semester: { term: keyof typeof SEMESTER_TERM_RANK; academicYear: { year: number } } },
  ) {
    if (candidate.semester.academicYear.year !== current.semester.academicYear.year) {
      return candidate.semester.academicYear.year > current.semester.academicYear.year;
    }
    return SEMESTER_TERM_RANK[candidate.semester.term] > SEMESTER_TERM_RANK[current.semester.term];
  }

  private isSelfServiceOnly(user: RequestUser) {
    return user.roles.includes('STUDENT') && !user.roles.includes('SUPER_ADMIN');
  }

  // §10: ADMIN/STAFF get scoped write access alongside STUDENT's unchanged
  // self-service and SUPER_ADMIN's unchanged unrestricted access — a
  // student never has ADMIN/STAFF too (registration only ever assigns
  // STUDENT, per PROJECT_CONTEXT.md §33), so this and isSelfServiceOnly
  // are mutually exclusive in practice.
  private isStaffTier(user: RequestUser) {
    return (
      (user.roles.includes('ADMIN') || user.roles.includes('STAFF')) &&
      !user.roles.includes('SUPER_ADMIN')
    );
  }

  // INSTRUCTOR may only correct/remove existing records in courses they are
  // assigned to (no create, no listing — the course roster endpoint covers
  // reads). A user who also holds ADMIN/STAFF takes the scope-based path
  // instead, so this never narrows an existing staff grant.
  private isInstructorTier(user: RequestUser) {
    return (
      user.roles.includes('INSTRUCTOR') &&
      !user.roles.includes('SUPER_ADMIN') &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('STAFF')
    );
  }

  private async assertInstructorAssigned(courseId: string, user: RequestUser) {
    const assignment = await this.prisma.courseInstructor.findUnique({
      where: { userId_courseId: { userId: user.userId, courseId } },
    });
    if (!assignment) {
      // 403, not 404 — same convention as InstructorGuard.
      throw new ForbiddenException('You are not assigned to this course');
    }
  }

  // Audit-trail snapshot for enteredByRole — most-privileged role wins if
  // a user somehow holds more than one (STUDENT never co-occurs with
  // ADMIN/STAFF/SUPER_ADMIN in practice, per §33, so this is unambiguous).
  private resolveActingRole(user: RequestUser): Role {
    if (user.roles.includes('SUPER_ADMIN')) return Role.SUPER_ADMIN;
    if (user.roles.includes('ADMIN')) return Role.ADMIN;
    if (user.roles.includes('STAFF')) return Role.STAFF;
    if (user.roles.includes('INSTRUCTOR')) return Role.INSTRUCTOR;
    return Role.STUDENT;
  }

  private async assertStaffScopeCovers(
    studentProfileId: string,
    user: RequestUser,
  ) {
    const ancestry = await this.scopeResolverService.resolveAncestry(
      'studentProfile',
      studentProfileId,
    );
    const effectiveScopes = await this.scopeResolverService.getEffectiveScopes(
      user.userId,
    );
    if (!this.scopeResolverService.isCovered(ancestry, effectiveScopes)) {
      throw new ForbiddenException(
        'You do not have scope covering this student',
      );
    }
  }

  // STUDENT: always their own profile, resolved server-side — the
  // client-supplied studentProfileId is ignored so a student can never
  // create/read a record under someone else's profile.
  // SUPER_ADMIN: uses the client-supplied studentProfileId, validated.
  // ADMIN/STAFF: uses the client-supplied studentProfileId, validated and
  // scope-checked.
  private async resolveOwnStudentProfileOrValidate(
    suppliedStudentProfileId: string,
    user: RequestUser,
  ) {
    if (this.isSelfServiceOnly(user)) {
      return this.studentProfileService.findByUserId(user.userId);
    }
    const profile = await this.studentProfileService.findActiveByIdOrThrow(
      suppliedStudentProfileId,
    );
    if (this.isStaffTier(user)) {
      await this.assertStaffScopeCovers(profile.id, user);
    }
    return profile;
  }
}
