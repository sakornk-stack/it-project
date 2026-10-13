// Phase 0: foundation only — shared types are added incrementally starting Phase 1.
// Frontend F1 (Auth pages) is the first consumer — Auth request/response
// shapes and the org-structure list-item shapes used by the dependent
// Faculty→Department→Program→Curriculum select on the Register page.

// ---- Auth requests ----

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  // Required unless invitationToken is set — when it is, the server
  // ignores these four and uses the StudentInvitation's own stored values
  // instead (see AuthService.register). Optional here only so the invited
  // flow can omit them entirely.
  studentCode?: string;
  programId?: string;
  curriculumId?: string;
  admissionYear?: number;
  invitationToken?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface CompleteGoogleRegistrationRequest {
  pendingToken: string;
  studentCode: string;
  programId: string;
  curriculumId: string;
  admissionYear: number;
}

// ---- Auth responses ----

// register/login/google/complete-registration/refresh: refresh token is
// an httpOnly cookie the browser handles automatically — never present in
// a JSON body, only the access token is.
export interface AccessTokenResponse {
  accessToken: string;
}

export type Role = 'STUDENT' | 'INSTRUCTOR' | 'STAFF' | 'ADMIN' | 'SUPER_ADMIN';

export interface CurrentUserResponse {
  userId: string;
  email: string;
  fullName: string;
  roles: Role[];
  mustChangePassword: boolean;
  // Whether TOTP 2FA is currently enabled — read live from
  // TwoFactorCredential every /auth/me call, same as mustChangePassword.
  twoFactorEnabled: boolean;
}

// ---- Authenticator-app (TOTP) 2FA — opt-in, see backend
// schema.prisma's TwoFactorCredential comment for full design rationale.
export interface TwoFactorSetupResponse {
  qrCodeDataUrl: string;
  // Plaintext secret for manual entry — shown alongside the QR as a
  // fallback if the authenticator app can't scan it.
  secret: string;
}

export interface TwoFactorEnableRequest {
  code: string;
}

// recoveryCodes is shown exactly once — there is no way to retrieve them
// again later (same "shown once" pattern as the old TempPasswordReveal).
export interface TwoFactorEnableResponse {
  recoveryCodes: string[];
}

export interface TwoFactorDisableRequest {
  password: string;
}

export interface TwoFactorVerifyRequest {
  code: string;
}

// POST /auth/login and GET /auth/google/callback's redirect both surface
// this shape when the account has 2FA enabled — the caller must submit
// pendingToken + a code to POST /auth/2fa/verify to get a real
// AccessTokenResponse.
export interface RequiresTwoFactorResponse {
  pendingToken: string;
  requiresTwoFactor: true;
}

export type LoginResponse = AccessTokenResponse | RequiresTwoFactorResponse;

// ---- Organization structure (public, unauthenticated GETs) ----

export interface FacultyListItem {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface DepartmentListItem {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  facultyId: string;
}

export interface ProgramListItem {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  departmentId: string;
}

export interface CurriculumListItem {
  id: string;
  version: string;
  effectiveYear: number;
  totalCredits: number;
  isActive: boolean;
  isOpenForRegistration: boolean;
  // CLO-oriented threshold (Clo.achievementThreshold falls back to this),
  // reused client-side by the CLO/PLO Analysis page as a stand-in PLO
  // cutoff since no PLO-specific threshold exists in the backend — not a
  // PLO-specific number, see that page's code comment.
  defaultAchievementThreshold: number;
  // Semester Planning cap (§28) — used by the Learning Path page to show
  // "X / maxCreditsPerSemester หน่วยกิต" against nextSemesterPlan's total.
  // Institution-specific default (22), not a universal constant.
  maxCreditsPerSemester: number;
  // Nominal program length (years) for the on-track expected-credits rule.
  durationYears: number;
  programId: string;
}

// ---- Organization management (SUPER_ADMIN) ----

export interface CreateFacultyRequest {
  name: string;
  code: string;
}
export type UpdateFacultyRequest = Partial<CreateFacultyRequest>;

export interface CreateDepartmentRequest {
  name: string;
  code: string;
  facultyId: string;
}
export type UpdateDepartmentRequest = Partial<Omit<CreateDepartmentRequest, 'facultyId'>>;

export interface CreateProgramRequest {
  name: string;
  code: string;
  departmentId: string;
}
export type UpdateProgramRequest = Partial<Omit<CreateProgramRequest, 'departmentId'>>;

export interface CreateCurriculumRequest {
  programId: string;
  version: string;
  effectiveYear: number;
  totalCredits: number;
  isOpenForRegistration?: boolean;
  defaultAchievementThreshold?: number;
  maxCreditsPerSemester?: number;
  durationYears?: number;
}
export type UpdateCurriculumRequest = Partial<Omit<CreateCurriculumRequest, 'programId'>>;

// ---- GET /dashboard/staff — STAFF's program/curriculum overview,
// scoped to their assigned org scope.

export interface StaffOverviewCurriculum {
  curriculumId: string;
  version: string;
  effectiveYear: number;
  studentCount: number;
  // null when no student in this curriculum has a graded course yet.
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
// cumulative GPA (< 1.50 CRITICAL, < 1.75 WATCH), not of one course grade.
export interface StaffAtRiskStudent {
  studentProfileId: string;
  studentCode: string;
  fullName: string;
  // Never NORMAL — this list is already filtered to the GPA bands.
  riskLevel: RiskLevel;
  // Courses whose latest grade is D+/D/F/U. Context only; never sets riskLevel.
  lowGradeCount: number;
  gpa: number | null;
  programCode: string;
  curriculumVersion: string;
}

// The directory's row: every student in scope, at-risk or not, so the
// page can filter by band. riskLevel is NORMAL for most, unlike
// StaffAtRiskStudent which is pre-filtered. NORMAL with gpa null means
// "no data" (no graded course counted toward a GPA).
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

export interface StaffOverviewReport {
  programs: StaffOverviewProgram[];
  // Capped worst-first preview — counts below cover the whole scope.
  atRiskStudents: StaffAtRiskStudent[];
  atRiskSummary: { critical: number; watch: number };
}

// ---- POST/GET /student-invitations — STAFF bulk-invites prospective
// STUDENTs. A row here is a token-gated draft, never itself an account —
// see PROJECT_CONTEXT.md §17 "NO REG IMPORT" and the schema.prisma comment
// on StudentInvitation for why. The invited person still self-registers
// via POST /auth/register with invitationToken set.

export interface CreateStudentInvitationRequest {
  email: string;
  fullName: string;
  studentCode: string;
  programId: string;
  curriculumId: string;
  admissionYear: number;
}

export interface StudentInvitationListEntry {
  id: string;
  email: string;
  fullName: string;
  studentCode: string;
  programId: string;
  curriculumId: string;
  admissionYear: number;
  expiresAt: string;
  createdAt: string;
  program: { code: string; name: string };
}

// GET /auth/invitation/:token — public, unauthenticated preview so the
// register page can pre-fill before the visitor has any account. Program/
// curriculum are surfaced by human-readable code/version, not raw ids —
// register() still re-resolves everything from the token server-side
// regardless of what the client echoes back.
export interface StudentInvitationPreview {
  email: string;
  fullName: string;
  studentCode: string;
  programCode: string;
  curriculumVersion: string;
  admissionYear: number;
}

// ---- GET /dashboard/curricula — SUPER_ADMIN system-wide view across
// every active curriculum. Mirrors dashboard-report.interface.ts.

// How much of a curriculum actually exists, decided by the backend so
// the UI never has to read "not built yet" out of a zero.
export type CurriculumDataState = 'HAS_STUDENTS' | 'STRUCTURE_ONLY' | 'EMPTY';

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
  averageGpa: number | null;
  studentsAtRiskCount: number;
  graduationReadyCount: number;
  // Mean of the radar points that have data; null when nothing measurable.
  averagePloValue: number | null;
  radar: RadarPoint[];
}

// Flagged from its own CLOs, not from averageValue — a radar value is an
// average attainment score while a CLO's achievementPercent is the share
// of students at B or above. Both are 0-100 and mean different things.
export interface ProblematicPloEntry {
  ploId: string;
  code: string;
  name: string;
  curriculumId: string;
  curriculumVersion: string;
  programCode: string;
  closBelowThreshold: number;
  // Excludes CLOs whose course nobody has taken yet.
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

// Mirrors the backend's CurriculumDashboardReport (GET /dashboard/curriculum/:id).
export interface LowestCloEntry {
  cloId: string;
  code: string;
  description: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  achievementPercent: number;
}

export interface CohortPloAchievementReport {
  curriculumId: string;
  admissionYear: number;
  studentCount: number;
  averageGpa: number | null;
  gpaSampleSize: number;
  radar: RadarPoint[];
  strengths: RadarPoint[];
  areasForImprovement: RadarPoint[];
}

export interface CurriculumDashboardReport {
  curriculumId: string;
  studentCount: number;
  averageGpa: number | null;
  gpaSampleSize: number;
  studentsAtRiskCount: number;
  graduationReadyCount: number;
  graduationReadyPercent: number | null;
  radar: RadarPoint[];
  strengths: RadarPoint[];
  areasForImprovement: RadarPoint[];
  lowestPlo: RadarPoint | null;
  lowestClos: LowestCloEntry[];
  courseAnalytics: { courseId: string; code: string; name: string; achievementPercent: number }[];
  cohortComparison: CohortPloAchievementReport[];
}

export interface SystemCurriculumOverviewReport {
  totals: {
    curriculumCount: number;
    curriculaWithStudentsCount: number;
    studentCount: number;
    graduationReadyCount: number;
    graduationReadyPercent: number | null;
    studentsAtRiskCount: number;
  };
  curricula: SystemCurriculumEntry[];
  problematicPlos: ProblematicPloEntry[];
  problematicClos: ProblematicCloEntry[];
}

// ---- GET /dashboard/admin/scope-overview — ADMIN's scoped counterpart to
// the system-wide curriculum dashboard above. Mirrors
// dashboard-report.interface.ts.

// Lighter than SystemCurriculumEntry (no GPA/radar) — only enough to place
// a curriculum into resolveDataState()'s 3 tiers.
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
  // Students hold no UserScope row (their scope is implicit via
  // StudentProfile.programId) — counted separately from the other roles.
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

// ---- GET /student-profiles/me — the logged-in STUDENT's own profile.
// Dashboard needs studentProfileId, which /auth/me does not expose
// (CurrentUserResponse is identity-only, not academic-record data) — this
// is the one extra call the dashboard page makes before fetching it.
export interface StudentProfileMeResponse {
  id: string;
  userId: string;
  studentCode: string;
  programId: string;
  curriculumId: string;
  admissionYear: number;
  isActive: boolean;
}

// ---- Student Dashboard (GET /dashboard/student/:studentProfileId) ----
// Mirrors apps/backend/src/modules/dashboard/dashboard-report.interface.ts

export type Grade =
  | 'A'
  | 'B_PLUS'
  | 'B'
  | 'C_PLUS'
  | 'C'
  | 'D_PLUS'
  | 'D'
  | 'F'
  | 'W'
  | 'I'
  | 'S'
  | 'U';

export interface GraduationReadiness {
  isReady: boolean;
  creditsMet: boolean;
  allCategoriesMet: boolean;
  missingRequiredCount: number;
}

export interface RadarPoint {
  ploId: string;
  code: string;
  name: string;
  // null = no relevant CLO data yet for this student — distinct from 0.
  value: number | null;
}

export interface RecentCourse {
  courseId: string;
  code: string;
  name: string;
  credits: number;
  grade: Grade;
  academicYear: number;
  semesterTerm: string;
}

export interface MissingRequiredCourse {
  courseId: string;
  code: string;
  name: string;
  credits: number;
  isPrerequisiteSatisfied: boolean;
}

export interface IncompleteElectiveCategory {
  categoryId: string;
  name: string;
  creditsEarned: number;
  minCredits: number;
  creditsShort: number;
  // Present on the real response (pass-through from LearningPathReport —
  // Dashboard's incompleteElectiveCategories is the same backend data,
  // not a separately-computed subset) but unused until the Learning Path
  // page needed it — CourseSummary is declared further down this file,
  // referencing it here is fine since TS type declarations aren't
  // order-sensitive.
  availableElectivesInCategory: CourseSummary[];
}

// One plotted point of the dashboard GPA sparkline: a semester with a real
// GPA, chronologically ordered (semesters whose courses are all W/I/S/U have
// no GPA and are left out). Per-semester GPA is NOT retake-deduped, so these
// need not average to the cumulative gpa.
export interface GpaTrendPoint {
  academicYear: number;
  semesterTerm: SemesterTerm;
  gpa: number;
  creditsCounted: number;
}

export interface StudentDashboardResponse {
  studentProfileId: string;
  gpa: number | null;
  gpaTrend: GpaTrendPoint[];
  creditsEarned: number;
  creditsRemaining: number;
  totalCreditsRequired: number;
  curriculumProgressPercent: number;
  yearLevel: number;
  // Credits expected at the start of the current academic year; null status
  // = nothing to judge (already at/over totalCreditsRequired).
  expectedCredits: number;
  onTrackStatus: 'on_track' | 'behind' | null;
  graduationReadiness: GraduationReadiness;
  radar: RadarPoint[];
  strengths: RadarPoint[];
  areasForImprovement: RadarPoint[];
  recentCourses: RecentCourse[];
  missingRequiredCourses: MissingRequiredCourse[];
  incompleteElectiveCategories: IncompleteElectiveCategory[];
  pendingAssessmentCount: number;
  // Module 7 exists as a standalone endpoint but the Dashboard doesn't
  // call it (kept fast/free) — always null here, by design, not a bug.
  aiSummary: null;
}

// ---- Detailed CLO/PLO Analysis (GET /plo-achievement/student/:studentProfileId) ----
// Same RadarPoint shape the Dashboard's `radar` field already uses (this
// endpoint and Dashboard's report share the identical interface
// server-side) — no status/description/threshold fields, joined
// client-side from GET /plos and the student's own curriculum.

// Per-CLO detail nested under a PLO — lets the CLO/PLO Analysis page show
// which courses/CLOs make up a PLO's number, not just the averaged value.
export interface StudentPloCloBreakdownEntry {
  cloId: string;
  code: string;
  description: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  score: number | null;
  isAchieved: boolean;
}

export interface StudentPloRadarPoint extends RadarPoint {
  cloBreakdown: StudentPloCloBreakdownEntry[];
}

export interface StudentPloAchievementResponse {
  studentProfileId: string;
  curriculumId: string;
  radar: StudentPloRadarPoint[];
  strengths: RadarPoint[];
  areasForImprovement: RadarPoint[];
}

// ---- Career fit (GET /students/me/career-fit) ----
export type CareerFitStatus = 'OK' | 'NO_GRADES' | 'NO_CAREERS';
export type CareerFitLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CareerFitEntry {
  careerId: string;
  careerName: string;
  status: 'OK' | 'INSUFFICIENT_DATA';
  score: number | null;
  level: CareerFitLevel | null;
  coverage: number;
  gradedCourseCount: number;
  totalCourseCount: number;
  topCourses: { code: string; name: string; grade: Grade }[];
  recommendedCourses: { code: string; name: string }[];
  message?: string;
}

export interface CareerFitReport {
  status: CareerFitStatus;
  message: string;
  careers: CareerFitEntry[];
}

// ---- AI Skill Analysis (GET /ai-analysis/student/:studentProfileId) ----
// Qualitative-only by construction (PROJECT_CONTEXT.md §25/26) — the
// Anthropic tool schema backing this has zero numeric fields, so there is
// no per-axis score here. The radar/hexagon chart on the Aptitude
// Analysis page is driven entirely by StudentPloAchievementResponse
// above (real, deterministic) — this type is prose-only interpretation
// shown alongside it, never a source of chart data.
export interface AiSkillAnalysisReport {
  studentProfileId: string;
  generatedAt: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface PloListItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  curriculumId: string;
}

// ---- Course Assessment (POST/PATCH/DELETE /course-assessments, GET .../course/:courseId/me) ----
// GET /clos — unfiltered, client-side filter by courseId, same pattern as
// GET /courses. CourseAssessmentResponse.cloScores is a plain Prisma
// `include`, not a join — raw rows with only cloId, no embedded CLO
// code/description (confirmed against course-assessment.service.ts).

export interface CloListItem {
  id: string;
  code: string;
  description: string;
  courseId: string;
}

export interface CloScoreInput {
  cloId: string;
  score: number; // 1-5
}

export interface CourseAssessmentCloScoreRow {
  id: string;
  score: number;
  courseAssessmentId: string;
  cloId: string;
}

export interface CourseAssessmentResponse {
  id: string;
  courseId: string;
  studentProfileId: string;
  comment: string | null;
  cloScores: CourseAssessmentCloScoreRow[];
}

// GET /course-assessments/me
export interface MyCourseAssessmentsResponse {
  assessments: CourseAssessmentResponse[];
  assessableCourseCount: number;
  pendingAssessmentCount: number;
}

export interface CreateCourseAssessmentRequest {
  courseId: string;
  cloScores: CloScoreInput[];
  comment?: string;
}

export interface UpdateCourseAssessmentRequest {
  cloScores: CloScoreInput[];
  comment?: string;
}

// ---- Smart Credit Checker (GET /credit-checker/:studentProfileId) ----
// Mirrors apps/backend's CreditCheckReport exactly, including its real
// quirks: creditsAccumulated is an exact alias of creditsPassed (not a
// separate calc), and missingRequiredCourses intentionally overlaps with
// failedCourses/notYetStudiedCourses (a required course not yet passed
// appears in both its status bucket and this list).

export interface CourseSummary {
  courseId: string;
  code: string;
  name: string;
  credits: number;
  grade?: Grade;
  isRequired: boolean;
  categoryId: string;
  // Raw prerequisite edges + the derived boolean, computed for EVERY
  // course (not just required-and-not-passed) — added for the
  // Prerequisite Flow Chart (F3), which needs the full graph.
  prerequisiteCourseIds: string[];
  isPrerequisiteSatisfied: boolean;
}

export interface CategoryProgress {
  categoryId: string;
  name: string;
  minCredits: number;
  minCourses: number | null;
  creditsEarned: number;
  coursesPassedCount: number;
  isComplete: boolean;
}

export interface CreditCheckReport {
  studentProfileId: string;
  curriculumId: string;
  totalCreditsRequired: number;
  creditsStudied: number;
  creditsPassed: number;
  creditsAccumulated: number;
  creditsRemaining: number;
  passedCourses: CourseSummary[];
  failedCourses: CourseSummary[];
  notYetStudiedCourses: CourseSummary[];
  missingRequiredCourses: CourseSummary[];
  categoryProgress: CategoryProgress[];
  graduationReadiness: GraduationReadiness;
}

// ---- Learning Path Planner (GET /learning-path/:studentProfileId) ----
// nextSemesterPlan/availableCourses are prerequisite-satisfied-only,
// credit-capped-at-maxCreditsPerSemester subsets — no pacing/AI-insight
// data exists anywhere backing this (confirmed against the service
// directly); the page must not fabricate either.

// isRequired now lives on CourseSummary itself.
export type AvailableCourse = CourseSummary;

export interface LearningPathReport {
  studentProfileId: string;
  curriculumId: string;
  availableCourses: AvailableCourse[];
  missingRequiredCourses: CourseSummary[];
  incompleteElectiveCategories: IncompleteElectiveCategory[];
  graduationReadiness: GraduationReadiness;
  nextSemesterPlan: AvailableCourse[];
}

// ---- Learning Path plan (GET/PUT/DELETE /learning-path-plan/me) ----
// The student's saved next-semester plan: course ids in display order.
// GET returns null when nothing is saved (client falls back to the
// recommended nextSemesterPlan). PUT replaces the whole list.

export interface LearningPathPlan {
  courseIds: string[];
}

export type SaveLearningPathPlanRequest = LearningPathPlan;

// ---- Credit Limit Request (GET/POST/DELETE /credit-limit-requests/me) ----
// Self-declared, no approval workflow — student picks a fixed preset, it
// takes effect immediately. One active request per student; POST replaces
// any existing one. See the CreditLimitRequestType enum doc comment in
// schema.prisma for the full rationale.

export type CreditLimitRequestType = 'EXCEED_MAX' | 'BELOW_MIN';

export interface CreditLimitRequest {
  id: string;
  studentProfileId: string;
  type: CreditLimitRequestType;
  reason: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCreditLimitRequestRequest {
  type: CreditLimitRequestType;
  reason: string;
}

// ---- My Academic Record (GET/POST/PATCH/DELETE /student-course-records) ----
// Mirrors apps/backend's StudentCourseRecord Prisma model — raw rows, no
// denormalized course/semester name (frontend joins client-side against
// GET /courses and GET /semesters, same as CreditCheckerService does
// server-side for its own reports).

export interface StudentCourseRecord {
  id: string;
  grade: Grade;
  credits: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  studentProfileId: string;
  courseId: string;
  semesterId: string;
}

export interface CreateStudentCourseRecordRequest {
  // Required by the DTO but ignored server-side for STUDENT (resolved from
  // the JWT instead) — sent anyway to satisfy validation, per
  // student-course-record.service.ts's resolveOwnStudentProfileIdOrValidate.
  studentProfileId: string;
  courseId: string;
  semesterId: string;
  grade: Grade;
}

export interface UpdateStudentCourseRecordRequest {
  grade: Grade;
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

// GET /student-course-records/gpa/:studentProfileId — cumulative GpaSummary
// fields plus a per-semester breakdown. bySemester is grouped from RAW
// records (not retake-deduped like the cumulative gpa above), so a course
// later retaken elsewhere still counts in the semester it was first
// attempted.
export interface GpaResult extends GpaSummary {
  bySemester: SemesterGpa[];
}

export interface CourseListItem {
  id: string;
  code: string;
  name: string;
  nameEn: string | null;
  credits: number;
  isRequired: boolean;
  isActive: boolean;
  curriculumId: string;
  categoryId: string;
}

export type SemesterTerm = 'FIRST' | 'SECOND' | 'SUMMER';

export interface AcademicYear {
  id: string;
  year: number;
  isActive: boolean;
}

export interface Semester {
  id: string;
  term: SemesterTerm;
  isActive: boolean;
  academicYearId: string;
}

// Rows pointing at a deactivated year/semester (every row, active or not).
// Permanent delete is only possible when all of these are 0.
export interface SemesterReferences {
  records: number;
  assessments: number;
}

export interface InactiveSemester extends Semester {
  references: SemesterReferences;
}

export interface InactiveAcademicYear extends AcademicYear {
  references: SemesterReferences & { activeSemesters: number };
}

// ---- Admin CRUD for AcademicYear/Semester (SUPER_ADMIN only) ----
export interface CreateAcademicYearRequest {
  year: number;
}

export type UpdateAcademicYearRequest = Partial<CreateAcademicYearRequest>;

// POST /academic-years/bulk — atomic; existing years/terms come back 'skipped'.
export interface BulkCreateAcademicYearsRequest {
  startYear: number;
  yearCount: number;
  terms: SemesterTerm[];
}

export type BulkCreateStatus = 'created' | 'skipped';

export interface BulkCreateAcademicYearsResponse {
  years: {
    year: number;
    status: BulkCreateStatus;
    semesters: { term: SemesterTerm; status: BulkCreateStatus }[];
  }[];
}

export interface CreateSemesterRequest {
  term: SemesterTerm;
  academicYearId: string;
}

export interface UpdateSemesterRequest {
  term?: SemesterTerm;
}

// ---- Instructor course roster (GET /courses/:courseId/students) ----
// No email field — the roster intentionally does not expose it.
// Severity bands of a latest-attempt grade. CRITICAL ∪ WATCH is exactly
// the at-risk population (AT_RISK_GRADES) — WATCH is not a wider net, it
// is the milder half of the same set. C+ is NORMAL, deliberately.
export type RiskLevel = 'CRITICAL' | 'WATCH' | 'NORMAL';

export interface StudentRosterEntry {
  studentProfileId: string;
  // The student's latest attempt of this course — needed to key
  // StudentAssessmentScore upserts (see assessment-evidence types below).
  studentCourseRecordId: string;
  studentCode: string;
  fullName: string;
  grade: Grade;
  riskLevel: RiskLevel;
}

// ---- Evidence-based CLO/PLO infrastructure (assessment-evidence module) ----
// Completely separate from grade-based CloAchievementService/
// PloAchievementService and from the 1-5 self-assessment
// (CourseAssessmentCloScore) above — see backend schema.prisma's
// "Evidence-based CLO/PLO infrastructure" comment block. Decimal fields
// (maxScore/weight/maxScoreOverride/score/coverage weights) come back as
// strings over the wire (Prisma.Decimal's JSON serialization), never
// numbers — parse with Number()/parseFloat() at the display boundary,
// never compare/sum them as strings.
export type MissingScorePolicy = 'EXCLUDE' | 'TREAT_AS_ZERO';
export type AssessmentScoreStatus = 'PENDING' | 'GRADED' | 'ABSENT' | 'EXCUSED';
export type EvidenceSource = 'EVIDENCE_BASED' | 'LEGACY_GRADE_ESTIMATE' | 'NO_EVIDENCE';
export type AchievementStatus = 'NO_EVIDENCE' | 'PARTIAL' | 'COMPLETE';

export interface AssessmentDefinition {
  id: string;
  title: string;
  kind: string;
  maxScore: string;
  missingScorePolicy: MissingScorePolicy;
  isActive: boolean;
  courseId: string;
  semesterId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssessmentDefinitionRequest {
  title: string;
  kind: string;
  maxScore: number;
  missingScorePolicy?: MissingScorePolicy;
  courseId: string;
  semesterId: string;
}

export interface AssessmentCloMapping {
  id: string;
  weight: string;
  maxScoreOverride: string | null;
  isActive: boolean;
  assessmentDefinitionId: string;
  cloId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssessmentCloMappingRequest {
  assessmentDefinitionId: string;
  cloId: string;
  weight: number;
  maxScoreOverride?: number;
  courseId: string;
}

export interface StudentAssessmentScore {
  id: string;
  score: string | null;
  status: AssessmentScoreStatus;
  assessmentCloMappingId: string;
  studentCourseRecordId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertStudentAssessmentScoreRequest {
  assessmentCloMappingId: string;
  studentCourseRecordId: string;
  score?: number;
  status: AssessmentScoreStatus;
  courseId: string;
}

export interface BulkUpsertStudentAssessmentScoresRequest {
  courseId: string;
  assessmentDefinitionId: string;
  assessmentCloMappingIds: string[];
  entries: {
    studentCourseRecordId: string;
    status: AssessmentScoreStatus;
    score?: number;
  }[];
}

export interface BulkUpsertStudentAssessmentScoresResponse {
  mappingCount: number;
  entryCount: number;
  written: number;
}

export interface CoverageInfo {
  validCount: number;
  totalCount: number;
  validWeight: string;
  totalWeight: string;
}

export interface AchievementResult {
  score: string | null;
  status: AchievementStatus;
  source: EvidenceSource;
  coverage: CoverageInfo;
}

// ---- Instructor dashboard (GET /dashboard/instructor) and course-level
// CLO achievement (GET /clo-achievement/course/:courseId) share this shape.
export interface CloAchievementEntry {
  cloId: string;
  code: string;
  description: string;
  threshold: number;
  isAchieved: boolean;
}

export interface CoursePloEntry {
  ploId: string;
  code: string;
  name: string;
  achievementPercent: number;
  cloBreakdown: { cloId: string; code: string; weight: number }[];
}

export interface AtRiskStudent {
  studentProfileId: string;
  studentCode: string;
  fullName: string;
  grade: Grade;
  // Never NORMAL here — this list is already filtered to at-risk grades.
  riskLevel: RiskLevel;
  academicYear: number;
  semesterTerm: SemesterTerm;
}

export interface SemesterAchievement {
  academicYear: number;
  semesterTerm: SemesterTerm;
  studentCount: number; // excludes W/I
  gradedCount: number; // A to F only (no W/I/S/U): the base for sample-size notes
  achievementPercent: number; // % graded B or above
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
  // full transcript.
  entries: StudentInstructorTimelineEntry[];
}

export interface InstructorCourseSummary {
  courseId: string;
  code: string;
  name: string;
  studentCount: number; // excludes W/I
  atRiskStudents: AtRiskStudent[]; // latest attempt C or below, worst first
  achievementPercent: number; // % graded B or above
  achievementThreshold: number; // the bar achievementPercent is judged against
  gradeDistribution: Record<Grade, number>; // full raw tally incl. W/I/S/U
  clos: CloAchievementEntry[];
  plos: CoursePloEntry[];
  courseAssessment: {
    courseId: string;
    submissionCount: number;
    clos: { cloId: string; code: string; averageScore: number | null; scoreCount: number }[];
  };
  // One point per semester with >=1 non-W/I record, sorted chronologically.
  semesterTrend: SemesterAchievement[];
}

export interface InstructorDashboardReport {
  courses: InstructorCourseSummary[];
}

// ---- GET /dashboard/instructor/course-timeline ----
// "My Courses" grouped by academic year -> semester -> course, for the
// teaching schedule view. Separate from InstructorDashboardReport above —
// no CLO/PLO/Course-Assessment data here, just enrollment + year-level.
export interface InstructorCourseTimelineCourse {
  courseId: string;
  code: string;
  name: string;
  // A course's code is only unique WITHIN one curriculum — these two
  // fields let the UI label which curriculum this row belongs to, since
  // the same code can legitimately appear under a different curriculum.
  programCode: string;
  curriculumYear: number;
  studentCount: number; // everyone enrolled this term — no W/I exclusion
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

export interface InstructorCourseTimelineReport {
  years: InstructorCourseTimelineYear[];
}

// ---- GET /dashboard/instructor/students ----
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
  // regardless of any courseId/riskLevel filter already applied to
  // `students` below.
  courses: { courseId: string; code: string; name: string }[];
  students: InstructorStudentEntry[];
}

// ---- GET /dashboard/instructor/year-levels ----
export interface YearLevelStudent {
  studentProfileId: string;
  studentCode: string;
  fullName: string;
  admissionYear: number;
  // null = no badge (curriculum complete or no requirement tree).
  onTrackStatus: 'on_track' | 'behind' | null;
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

// clos here shares one course-level achievementPercent across every entry
// (a backend/schema limitation, not a frontend bug) — do not try to derive
// per-CLO percentages from it.
export interface CourseCloAchievementReport {
  courseId: string;
  totalStudents: number;
  achievedStudents: number;
  achievementPercent: number;
  // Curriculum.defaultAchievementThreshold — present even when clos is
  // empty, unlike each CloAchievementEntry.threshold.
  achievementThreshold: number;
  clos: CloAchievementEntry[];
}

// ---- Module 12: User Management (SUPER_ADMIN/ADMIN) ----
// Mirrors UserManagementService.toSummary's mapped shape — roles is a
// flat Role[] (from the UserRole relation), scopes is the raw UserScope[]
// relation as-is (no joined faculty/department/program name; the
// frontend resolves names client-side from the already-cached
// GET /faculties, /departments, /programs lists, same as everywhere else
// in this app).

export type ScopeLevel = 'FACULTY' | 'DEPARTMENT' | 'PROGRAM';

export interface UserScope {
  id: string;
  userId: string;
  level: ScopeLevel;
  facultyId: string | null;
  departmentId: string | null;
  programId: string | null;
  createdAt: string;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  roles: Role[];
  scopes: UserScope[];
}

export interface InitialScope {
  level: ScopeLevel;
  targetId: string;
}

// role:STUDENT is never accepted here — enforced server-side (CreateUserDto
// mirrors this exactly, minus the runtime rejection).
export interface CreateUserRequest {
  email: string;
  fullName: string;
  role: Role;
  scope?: InitialScope;
}

// No more temp password shown to the requester — the new account gets an
// unusable generated password hash, and a real "set your password" email
// is sent automatically (EmailService, reusing the same reset-token
// mechanism as POST /auth/forgot-password). passwordSetupEmailSent is
// false only if SMTP failed — the account still exists either way, and
// the fallback is the ordinary forgot-password flow at /login.
export interface CreateUserResponse {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  passwordSetupEmailSent: boolean;
}

export interface UpdateUserActiveStatusRequest {
  isActive: boolean;
}

export interface AssignRoleRequest {
  role: Role;
}

export interface CreateUserScopeRequest {
  level: ScopeLevel;
  targetId: string;
}

// ---- STAFF: Student Directory ----

export interface StudentProfileSummary {
  id: string;
  userId: string;
  studentCode: string;
  programId: string;
  curriculumId: string;
  admissionYear: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: { fullName: string; email: string };
}

// ---- STAFF: picking an instructor for CourseInstructor ----

export interface InstructorListItem {
  id: string;
  fullName: string;
  email: string;
}

// ---- Curriculum content: Course Category ----

export interface CourseCategory {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  curriculumId: string;
}

export interface CreateCourseCategoryRequest {
  name: string;
  code?: string;
  curriculumId: string;
}

export type UpdateCourseCategoryRequest = Partial<
  Pick<CreateCourseCategoryRequest, 'name' | 'code'>
>;

// ---- Curriculum content: Curriculum Requirement (1:1 with CourseCategory) ----

export interface CurriculumRequirement {
  id: string;
  minCredits: number;
  minCourses: number | null;
  createdAt: string;
  updatedAt: string;
  curriculumId: string;
  categoryId: string;
}

export interface CreateCurriculumRequirementRequest {
  curriculumId: string;
  categoryId: string;
  minCredits: number;
  minCourses?: number;
}

export type UpdateCurriculumRequirementRequest = Partial<
  Pick<CreateCurriculumRequirementRequest, 'minCredits' | 'minCourses'>
>;

// ---- Curriculum content: Prerequisite ----

export interface Prerequisite {
  id: string;
  courseId: string;
  prerequisiteCourseId: string;
  groupId: string | null;
  createdAt: string;
}

export interface CreatePrerequisiteRequest {
  courseId: string;
  prerequisiteCourseId: string;
  groupId?: string;
}

export interface UpdatePrerequisiteRequest {
  groupId?: string;
}

// ---- Curriculum content: Course Instructor (assignment) ----

export interface CourseInstructor {
  id: string;
  userId: string;
  courseId: string;
  createdAt: string;
}

export interface CreateCourseInstructorRequest {
  userId: string;
  courseId: string;
}

// ---- Curriculum content: Course create/update (STAFF course management) ----

export interface CreateCourseRequest {
  code: string;
  name: string;
  nameEn?: string;
  credits: number;
  description?: string;
  isRequired?: boolean;
  curriculumId: string;
  categoryId: string;
}

export type UpdateCourseRequest = Partial<Omit<CreateCourseRequest, 'curriculumId'>>;
