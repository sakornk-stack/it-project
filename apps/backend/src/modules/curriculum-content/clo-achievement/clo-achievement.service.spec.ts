import { CloAchievementService } from './clo-achievement.service';
import { LatestCourseAttempt } from '../../academic-record/student-course-record/student-course-record.service';

const attempt = (grade: string) => ({ grade }) as unknown as LatestCourseAttempt;
const byStudent = (...grades: string[]) =>
  new Map(grades.map((g, i) => [`s${i}`, attempt(g)]));

describe('CloAchievementService.summarizeCourseAchievement', () => {
  const service = new CloAchievementService(
    undefined as never,
    undefined as never,
    undefined as never,
    undefined as never,
  );

  it('returns null (not 0) when nobody has a final grade', () => {
    expect(service.summarizeCourseAchievement(new Map())).toEqual({
      totalStudents: 0,
      achievedStudents: 0,
      achievementPercent: null,
    });
  });

  it('returns null when every record is W/I (excluded)', () => {
    const result = service.summarizeCourseAchievement(byStudent('W', 'I'));
    expect(result.totalStudents).toBe(0);
    expect(result.achievementPercent).toBeNull();
  });

  it('returns a real 0 when students have grades and none reached B', () => {
    const result = service.summarizeCourseAchievement(byStudent('F', 'D'));
    expect(result.totalStudents).toBe(2);
    expect(result.achievementPercent).toBe(0);
  });

  it('counts only graded students when some are W/I', () => {
    const result = service.summarizeCourseAchievement(byStudent('A', 'F', 'W'));
    expect(result.totalStudents).toBe(2);
    expect(result.achievementPercent).toBe(50);
  });

  it('a course graded only S/U has no data (null), not 0%', () => {
    const result = service.summarizeCourseAchievement(byStudent('S', 'S', 'U', 'S'));
    expect(result).toEqual({ totalStudents: 0, achievedStudents: 0, achievementPercent: null });
  });

  it('S and U are left out of the base when mixed with letter grades', () => {
    // Letter grades: A, B, C, F -> 2 of 4 reached B. The S/U students change nothing.
    const result = service.summarizeCourseAchievement(byStudent('A', 'S', 'B', 'U', 'C', 'S', 'F'));
    expect(result.totalStudents).toBe(4);
    expect(result.achievedStudents).toBe(2);
    expect(result.achievementPercent).toBe(50);
  });

  it('a course with ordinary letter grades gives the same figure as before', () => {
    const result = service.summarizeCourseAchievement(
      byStudent('A', 'B_PLUS', 'B', 'C_PLUS', 'C', 'D_PLUS', 'D', 'F'),
    );
    expect(result).toEqual({ totalStudents: 8, achievedStudents: 3, achievementPercent: 37.5 });
  });
});
