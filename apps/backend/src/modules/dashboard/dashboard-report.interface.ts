import { OnTrackStatus } from '../../common/academic/year-level';
import { Grade } from '@prisma/client';
import { GraduationReadiness } from '../academic-record/credit-checker/credit-checker-report.interface';
import { RadarPoint } from '../curriculum-content/plo-achievement/plo-achievement-report.interface';
import { LearningPathReport } from '../academic-record/learning-path/learning-path-report.interface';
import { CourseCloAchievementReport } from '../curriculum-content/clo-achievement/clo-achievement-report.interface';
import { CoursePloAchievementReport } from '../curriculum-content/plo-achievement/plo-achievement-report.interface';
import { CurriculumPloAchievementReport } from '../curriculum-content/plo-achievement/plo-achievement-report.interface';
import { CourseAssessmentService } from '../curriculum-content/course-assessment/course-assessment.service';
import {
  SemesterAchievement,
  InstructorCourseTimelineYear,
} from '../academic-record/student-course-record/student-course-record.service';
import { RiskLevel } from '../academic-record/student-course-record/grade-point.constant';
import { GpaTrendPoint } from '../academic-record/student-course-record/gpa-trend';

export interface RecentCourse {
  courseId: string;
  code: string;
  name: string;
  credits: number;
  grade: Grade;
  academicYear: number;
  semesterTerm: string;
}

export interface StudentDashboardReport {
  studentProfileId: string;
  gpa: number | null;
  gpaTrend: GpaTrendPoint[];
  creditsEarned: number;
  creditsRemaining: number;
  totalCreditsRequired: number;
  curriculumProgressPercent: number;
  yearLevel: number;
  expectedCredits: number;
  onTrackStatus: OnTrackStatus | null;
  graduationReadiness: GraduationReadiness;
  radar: RadarPoint[];
  strengths: RadarPoint[];
  areasForImprovement: RadarPoint[];
  recentCourses: RecentCourse[];
  missingRequiredCourses: LearningPathReport['missingRequiredCourses'];
  incompleteElectiveCategories: LearningPathReport['incompleteElectiveCategories'];
  pendingAssessmentCount: number;
  // Module 7 (AI Skill Analysis) hasn't started — left null, not omitted,
  // so the frontend has a stable field to check rather than an optional
  // one that silently disappears (PROJECT_CONTEXT.md §25/§26: AI only
  // interprets already-computed numbers, never invents them).
  aiSummary: null;
}

export interface AtRiskStudent {
  studentProfileId: string;
  studentCode: string;
  fullName: string;
  grade: Grade;
  // Always CRITICAL or WATCH here — this list is already filtered to
  // AT_RISK_GRADES, and those two bands are exactly its partition.
  riskLevel: RiskLevel;
  academicYear: number;
  semesterTerm: string;
}

export interface InstructorCourseSummary {
  courseId: string;
  code: string;
  name: string;
  studentCount: number;
  // Latest attempt graded C or below (AT_RISK_GRADES), worst first.
  atRiskStudents: AtRiskStudent[];
  // "% B ขึ้นไป" per §30 — pass-through of Phase 8's course-level %.
  // null = no student with a final grade yet.
  achievementPercent: number | null;
  // The bar achievementPercent is judged against, so the UI never has to
  // invent its own fixed bands.
  achievementThreshold: number;
  // Full A-F (+W/I/S/U) tally per §30's "Grade Distribution" — raw counts,
  // not pre-filtered like achievementPercent above.
  gradeDistribution: Record<Grade, number>;
  clos: CourseCloAchievementReport['clos'];
  plos: CoursePloAchievementReport['plos'];
  courseAssessment: Awaited<
    ReturnType<CourseAssessmentService['getAggregateForCourse']>
  >;
  // One point per semester with >=1 non-W/I record, sorted chronologically.
  semesterTrend: SemesterAchievement[];
}

export interface InstructorDashboardReport {
  courses: InstructorCourseSummary[];
}

// "My Courses" grouped by Academic Year -> Semester, for the teaching
// schedule view — separate from InstructorDashboardReport's flat list
// (which carries CLO/PLO achievement this view doesn't need).
export interface InstructorCourseTimelineReport {
  years: InstructorCourseTimelineYear[];
}

// One row per (student, course) pair across ALL of the instructor's
// courses — unlike StudentRosterEntry (single-course only), a student
// taking two of the instructor's courses appears here twice, once per
// course context.
export interface InstructorStudentEntry {
  studentProfileId: string;
  studentCode: string;
  fullName: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  grade: Grade;
  riskLevel: RiskLevel;
}

export interface InstructorStudentsReport {
  // For the filter dropdown — every course this instructor teaches,
  // regardless of any courseId/riskLevel filter already applied below.
  courses: { courseId: string; code: string; name: string }[];
  students: InstructorStudentEntry[];
}

export interface YearLevelStudent {
  studentProfileId: string;
  studentCode: string;
  fullName: string;
  admissionYear: number;
  onTrackStatus: OnTrackStatus | null;
}

export interface YearLevelBucket<T extends YearLevelStudent = YearLevelStudent> {
  // 1-4; students admitted earlier than 4 years ago collapse into
  // bucket 4 ("ปี 4 ขึ้นไป") rather than an unbounded number of buckets.
  yearLevel: number;
  label: string;
  students: T[];
}

export interface InstructorYearLevelsReport {
  // Derived as MAX(year) among active AcademicYear rows — there is no
  // stored "current academic year" field in the schema.
  currentAcademicYear: number;
  buckets: YearLevelBucket[];
}

export interface StaffYearLevelStudent extends YearLevelStudent {
  gpa: number | null;
  riskLevel: RiskLevel;
  lowGradeCount: number;
}

export interface StaffYearLevelsReport {
  currentAcademicYear: number;
  buckets: YearLevelBucket<StaffYearLevelStudent>[];
}

export interface CurriculumDashboardReport extends CurriculumPloAchievementReport {
  // Module 7 hasn't started — same null-not-omitted reasoning as above.
  aiCurriculumSummary: null;
}

export interface StaffOverviewCurriculum {
  curriculumId: string;
  version: string;
  effectiveYear: number;
  studentCount: number;
  // null when no student in this curriculum has a graded course yet —
  // same convention as GpaSummary.gpa (not 0, which would misread as F).
  averageGpa: number | null;
  totalCourses: number;
  coursesWithoutClo: number;
}

export interface StaffOverviewProgram {
  programId: string;
  programName: string;
  programCode: string;
  departmentName: string;
  facultyName: string;
  curricula: StaffOverviewCurriculum[];
}

// One row per student, not per attempt — staff act on people, where an
// instructor acts on a course. riskLevel is the band of the student's
// cumulative GPA (gpaRiskLevel), not of any single course grade.
export interface StaffAtRiskStudent {
  studentProfileId: string;
  studentCode: string;
  fullName: string;
  // Never NORMAL — this list is already filtered to the GPA bands.
  riskLevel: RiskLevel;
  // Courses whose latest grade is D+/D/F/U. Context only; it never sets riskLevel.
  lowGradeCount: number;
  gpa: number | null;
  // A scope can span programs, so a name alone doesn't say where to look.
  programCode: string;
  curriculumVersion: string;
}

// The directory's row: every student in scope, at-risk or not, so the
// page can filter by band. riskLevel is NORMAL here for most students,
// unlike StaffAtRiskStudent which is pre-filtered.
export interface StaffStudentRiskEntry {
  studentProfileId: string;
  studentCode: string;
  fullName: string;
  programId: string;
  curriculumId: string;
  admissionYear: number;
  isActive: boolean;
  riskLevel: RiskLevel;
  gpa: number | null;
  lowGradeCount: number;
}

// How much of a curriculum actually exists, decided at the source rather
// than inferred from zero-counts in the UI. Most curricula in the system
// are EMPTY shells, and "nobody has enrolled yet" has to read differently
// from "every student is failing" — a distinction a bare 0 destroys.
export type CurriculumDataState =
  | 'HAS_STUDENTS'
  | 'STRUCTURE_ONLY'
  | 'EMPTY';

export interface SystemCurriculumEntry {
  curriculumId: string;
  version: string;
  effectiveYear: number;
  programCode: string;
  programName: string;
  departmentName: string;
  facultyName: string;
  dataState: CurriculumDataState;
  studentCount: number;
  courseCount: number;
  cloCount: number;
  ploCount: number;
  // null rather than 0 wherever nothing could be measured — same
  // convention as StaffOverviewCurriculum.averageGpa.
  averageGpa: number | null;
  studentsAtRiskCount: number;
  graduationReadyCount: number;
  // Mean of the PLO radar points that have data. null when the
  // curriculum has no PLOs or no student has touched any mapped course.
  averagePloValue: number | null;
  radar: RadarPoint[];
}

// A PLO is flagged from its own CLOs rather than from its radar value:
// RadarPoint.value is an average attainment score (gradePoint/4*100)
// while a CLO's achievementPercent is the share of students at B or
// above. Both are 0-100 and they are NOT interchangeable, so the
// threshold comparison lives on the side that already defines one.
//
// Counts are always exposed, never just the verdict, because the
// underlying grain is coarser than it looks: every CLO in a course
// carries that course's single achievementPercent (Phase 8 limitation),
// so "3 of 6 CLOs below" really means "3 of the 6 courses behind this
// PLO are below".
export interface ProblematicPloEntry {
  ploId: string;
  code: string;
  name: string;
  curriculumId: string;
  curriculumVersion: string;
  programCode: string;
  closBelowThreshold: number;
  // Only CLOs whose course has at least one graded student — a course
  // nobody has taken is not evidence of a weak PLO.
  totalMeasuredClos: number;
  averageValue: number | null;
}

export interface ProblematicCloEntry {
  cloId: string;
  code: string;
  description: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  curriculumId: string;
  curriculumVersion: string;
  programCode: string;
  achievementPercent: number;
  threshold: number;
}

export interface SystemCurriculumOverviewReport {
  totals: {
    curriculumCount: number;
    curriculaWithStudentsCount: number;
    studentCount: number;
    graduationReadyCount: number;
    // null when no student exists at all — never a bare 0/0.
    graduationReadyPercent: number | null;
    studentsAtRiskCount: number;
  };
  // Curricula that have students first, then the rest — the UI groups on
  // dataState but the order already puts what matters on top.
  curricula: SystemCurriculumEntry[];
  problematicPlos: ProblematicPloEntry[];
  problematicClos: ProblematicCloEntry[];
}

export interface StaffOverviewReport {
  programs: StaffOverviewProgram[];
  // Capped — a FACULTY scope covers every program in the faculty, so this
  // is a worst-first preview, not the full set. Counts below are of the
  // whole scope; the student directory holds the complete list.
  atRiskStudents: StaffAtRiskStudent[];
  atRiskSummary: { critical: number; watch: number };
}

// Lighter than SystemCurriculumEntry (no GPA/radar) — this overview only
// needs enough to place a curriculum into resolveDataState()'s 3 tiers.
export interface AdminScopeCurriculumEntry {
  curriculumId: string;
  version: string;
  effectiveYear: number;
  programCode: string;
  programName: string;
  dataState: CurriculumDataState;
  studentCount: number;
  courseCount: number;
  ploCount: number;
}

export interface AdminScopeProgram {
  programId: string;
  code: string;
  name: string;
  departmentName: string;
  facultyName: string;
}

export interface AdminScopeOverviewReport {
  scope: {
    facultyCount: number;
    departmentCount: number;
    programCount: number;
    programs: AdminScopeProgram[];
  };
  // Students never hold a UserScope row (their scope is implicit via
  // StudentProfile.programId) — counted separately from the other three
  // roles, which are always counted via the requester's own UserScope
  // ancestry (ScopeResolverService.buildUserScopeOrFilter).
  userCounts: {
    staff: number;
    instructor: number;
    admin: number;
    student: number;
  };
  curricula: {
    totalCount: number;
    hasStudentsCount: number;
    structureOnlyCount: number;
    emptyCount: number;
    entries: AdminScopeCurriculumEntry[];
  };
}
