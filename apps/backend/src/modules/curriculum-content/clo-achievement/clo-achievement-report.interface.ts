export interface CloAchievementEntry {
  cloId: string;
  code: string;
  description: string;
  threshold: number;
  isAchieved: boolean;
}

export interface CourseCloAchievementReport {
  courseId: string;
  totalStudents: number;
  achievedStudents: number;
  // null = no student with a final grade yet (distinct from a real 0%).
  achievementPercent: number | null;
  // Curriculum.defaultAchievementThreshold — the course-level bar, kept
  // separate from each CloAchievementEntry.threshold (which may override
  // it per CLO). Present even when clos is empty, so a course with no CLOs
  // defined still has a threshold to compare achievementPercent against.
  achievementThreshold: number;
  clos: CloAchievementEntry[];
}
