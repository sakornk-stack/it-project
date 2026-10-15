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
});
