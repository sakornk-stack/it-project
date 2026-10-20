import type {
  AchievementResult,
  AssessmentCloMapping,
  AssessmentDefinition,
  StudentAssessmentScore,
} from '@eduanalyze-ai/shared-types';
import { apiClient } from '../api-client';

// Read-only wrappers for the assessment-evidence endpoints (no screen writes scores any
// more) — completely separate from lib/api/course-assessment.ts (1-5 self-assessment) and
// the grade-based endpoints in lib/api/instructor.ts. Plain thin functions, same pattern as
// course-assessment.ts: no useQuery/useMutation colocated here, callers wire these into
// React Query themselves.

export async function fetchAssessmentDefinitions(courseId: string) {
  const { data } = await apiClient.get<AssessmentDefinition[]>(
    `/assessment-definitions/course/${courseId}`,
  );
  return data;
}

export async function fetchAssessmentCloMappings(assessmentDefinitionId: string, courseId: string) {
  const { data } = await apiClient.get<AssessmentCloMapping[]>(
    `/assessment-clo-mappings/assessment-definition/${assessmentDefinitionId}`,
    { params: { courseId } },
  );
  return data;
}

export async function fetchStudentAssessmentScores(assessmentCloMappingId: string, courseId: string) {
  const { data } = await apiClient.get<StudentAssessmentScore[]>(
    `/student-assessment-scores/clo-mapping/${assessmentCloMappingId}`,
    { params: { courseId } },
  );
  return data;
}

// Evidence-based Actual CLO Achievement for one attempt — shown on the instructor student
// timeline and in the coverage badge when scores exist. Never confuse with
// the grade-based CLO achievement in lib/api/instructor.ts.
export async function fetchActualCloAchievement(
  courseId: string,
  studentCourseRecordId: string,
  cloId: string,
) {
  const { data } = await apiClient.get<AchievementResult>(
    `/actual-clo-achievement/course/${courseId}/student-course-record/${studentCourseRecordId}/clo/${cloId}`,
  );
  return data;
}
