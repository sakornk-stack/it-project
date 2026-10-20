import { useQuery, type QueryClient } from '@tanstack/react-query';
import { fetchCourses } from '@/lib/api/academic-record';
import {
  fetchCourseCloAchievement,
  fetchCourseRoster,
  fetchInstructorCourseTimeline,
  fetchInstructorDashboard,
  fetchInstructorStudents,
  fetchInstructorYearLevels,
  fetchStudentTimeline,
} from '@/lib/api/instructor';
import { fetchPrerequisites } from '@/lib/api/staff';

// Every query key of the instructor pages, in one place. All start with
// 'instructor' so none can collide with the key another role uses for a different
// payload (the student and staff pages have their own ['courses'], for example).
// Pages that read the same data share one cache entry through these keys.
export const instructorKeys = {
  dashboard: ['instructor-dashboard'] as const,
  courseTimeline: ['instructor-course-timeline'] as const,
  students: ['instructor-students'] as const,
  yearLevels: ['instructor-year-levels'] as const,
  courseCatalog: ['instructor-course-catalog'] as const,
  prerequisites: ['instructor-prerequisites'] as const,
  courseRoster: (courseId: string) => ['instructor-course-roster', courseId] as const,
  courseCloAchievement: (courseId: string) =>
    ['instructor-course-clo-achievement', courseId] as const,
  studentTimeline: (courseId: string, studentProfileId: string) =>
    ['instructor-student-timeline', courseId, studentProfileId] as const,
  // Prefix of every student timeline of one course, for invalidation.
  studentTimelinesOfCourse: (courseId: string) => ['instructor-student-timeline', courseId] as const,
};

// `enabled` is the page's role check (the caller is an instructor); components
// below a guarded page can leave it out.
type Gate = { enabled?: boolean };

export const useInstructorDashboard = ({ enabled = true }: Gate = {}) =>
  useQuery({ queryKey: instructorKeys.dashboard, queryFn: fetchInstructorDashboard, enabled });

export const useInstructorCourseTimeline = ({ enabled = true }: Gate = {}) =>
  useQuery({
    queryKey: instructorKeys.courseTimeline,
    queryFn: fetchInstructorCourseTimeline,
    enabled,
  });

// Shared by the students page, the year-levels page and the course overview.
export const useInstructorStudents = ({ enabled = true }: Gate = {}) =>
  useQuery({
    queryKey: instructorKeys.students,
    queryFn: () => fetchInstructorStudents({}),
    enabled,
  });

export const useInstructorYearLevels = ({ enabled = true }: Gate = {}) =>
  useQuery({ queryKey: instructorKeys.yearLevels, queryFn: fetchInstructorYearLevels, enabled });

export const useInstructorCourseCatalog = ({ enabled = true }: Gate = {}) =>
  useQuery({ queryKey: instructorKeys.courseCatalog, queryFn: fetchCourses, enabled });

export const useInstructorPrerequisites = ({ enabled = true }: Gate = {}) =>
  useQuery({ queryKey: instructorKeys.prerequisites, queryFn: fetchPrerequisites, enabled });

export const useCourseRoster = (courseId: string, { enabled = true }: Gate = {}) =>
  useQuery({
    queryKey: instructorKeys.courseRoster(courseId),
    queryFn: () => fetchCourseRoster(courseId),
    enabled,
  });

export const useCourseCloAchievement = (courseId: string, { enabled = true }: Gate = {}) =>
  useQuery({
    queryKey: instructorKeys.courseCloAchievement(courseId),
    queryFn: () => fetchCourseCloAchievement(courseId),
    enabled,
  });

export const useStudentTimeline = (courseId: string, studentProfileId: string) =>
  useQuery({
    queryKey: instructorKeys.studentTimeline(courseId, studentProfileId),
    queryFn: () => fetchStudentTimeline(courseId, studentProfileId),
  });

// After a grade is saved: everything that is computed from grades. The dashboard
// and CLO figures of the course, the roster, the students page, the year-level
// views (they count the same grades) and the course timeline's graded counts.
export function invalidateAfterGradeChange(queryClient: QueryClient, courseId: string) {
  const keys: readonly (readonly unknown[])[] = [
    instructorKeys.courseRoster(courseId),
    instructorKeys.courseCloAchievement(courseId),
    instructorKeys.studentTimelinesOfCourse(courseId),
    instructorKeys.dashboard,
    instructorKeys.students,
    instructorKeys.yearLevels,
    instructorKeys.courseTimeline,
  ];
  for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
}
