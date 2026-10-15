export interface RadarPoint {
  ploId: string;
  code: string;
  name: string;
  // null = no relevant CLO data yet for this student (never assessed) —
  // must stay distinguishable from 0 (assessed and scored zero).
  value: number | null;
}

// Per-CLO detail nested under a PLO — exposes scoreForClo's already-computed
// intermediate value (previously discarded after weighting into RadarPoint.value)
// so the CLO/PLO Analysis page can show a "why" behind each PLO number.
export interface StudentPloCloBreakdownEntry {
  cloId: string;
  code: string;
  description: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  // Same 0-100 scale and null semantics as RadarPoint.value.
  score: number | null;
  // score !== null && score >= (Clo.achievementThreshold ?? Curriculum.defaultAchievementThreshold)
  isAchieved: boolean;
}

export interface StudentPloRadarPoint extends RadarPoint {
  cloBreakdown: StudentPloCloBreakdownEntry[];
}

export interface StudentPloAchievementReport {
  studentProfileId: string;
  curriculumId: string;
  radar: StudentPloRadarPoint[];
  // Convenience derived fields — rank-based top/bottom-2 of PLOs with
  // non-null data only, never overlapping. The `radar` array above is the
  // source of truth; these are just a UI shortcut (PROJECT_CONTEXT.md §25:
  // AI/frontend interprets already-computed numbers, doesn't invent them).
  strengths: RadarPoint[];
  areasForImprovement: RadarPoint[];
}

export interface CoursePloEntry {
  ploId: string;
  code: string;
  name: string;
  // null = no CLO of this PLO in the course has data yet.
  achievementPercent: number | null;
  cloBreakdown: { cloId: string; code: string; weight: number }[];
}

export interface CoursePloAchievementReport {
  courseId: string;
  // Pass-through from Phase 8's course-level %; null = no data.
  achievementPercent: number | null;
  plos: CoursePloEntry[];
}

export interface CohortPloAchievementReport {
  curriculumId: string;
  admissionYear: number;
  studentCount: number;
  // null = zero students in the cohort have any graded record — never 0.
  averageGpa: number | null;
  // Students contributing to averageGpa (excludes null-GPA students).
  gpaSampleSize: number;
  // Averaged per PLO, null if zero students have data for that PLO.
  radar: RadarPoint[];
  strengths: RadarPoint[];
  areasForImprovement: RadarPoint[];
}

export interface LowestCloEntry {
  cloId: string;
  code: string;
  description: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  achievementPercent: number;
}

export interface CourseAnalyticsEntry {
  courseId: string;
  code: string;
  name: string;
  // null = no student with a final grade in this course yet.
  achievementPercent: number | null;
}

export interface CurriculumPloAchievementReport {
  curriculumId: string;
  studentCount: number;
  averageGpa: number | null;
  gpaSampleSize: number;
  // gpa !== null && gpaRiskLevel(gpa) !== 'NORMAL', i.e. GPA below
  // GPA_WATCH_BELOW (1.75; CRITICAL below 1.50) — a confirmed, deliberately
  // narrow product decision. Excludes gpa === null students
  // ("no data" is not the same as "at risk").
  studentsAtRiskCount: number;
  graduationReadyCount: number;
  // null only if studentCount === 0 — never a bare 0/0 division.
  graduationReadyPercent: number | null;
  radar: RadarPoint[];
  strengths: RadarPoint[];
  areasForImprovement: RadarPoint[];
  // null if the curriculum has zero PLOs or none have data.
  lowestPlo: RadarPoint | null;
  // ALL CLOs tied at the minimum achievementPercent, not an arbitrary
  // single pick — ties are common here (every CLO in one course shares
  // that course's achievementPercent, a documented Phase 8 limitation).
  // Empty if the curriculum has zero CLOs.
  lowestClos: LowestCloEntry[];
  courseAnalytics: CourseAnalyticsEntry[];
  // One entry per distinct admissionYear among active students, sorted
  // ascending — doubles as trend data across cohorts.
  cohortComparison: CohortPloAchievementReport[];
}
