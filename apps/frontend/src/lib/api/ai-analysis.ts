import type { AiSkillAnalysisReport } from '@eduanalyze-ai/shared-types';
import { apiClient } from '../api-client';

export async function fetchAiSkillAnalysis(studentProfileId: string) {
  const { data } = await apiClient.get<AiSkillAnalysisReport>(
    `/ai-analysis/student/${studentProfileId}`,
  );
  return data;
}
