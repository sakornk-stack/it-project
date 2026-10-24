import type { AiCareerSuggestionReport, AiSkillAnalysisReport } from '@eduanalyze-ai/shared-types';
import { apiClient } from '../api-client';

export async function fetchAiSkillAnalysis(studentProfileId: string) {
  const { data } = await apiClient.get<AiSkillAnalysisReport>(
    `/ai-analysis/student/${studentProfileId}`,
  );
  return data;
}

// Sends the student's computed results to Anthropic (see lib/ai-disclosure.ts):
// call it only from a button the student pressed, never on page load.
export async function fetchAiCareerSuggestions(studentProfileId: string) {
  const { data } = await apiClient.get<AiCareerSuggestionReport>(
    `/ai-analysis/student/${studentProfileId}/careers`,
    // The model may think for a while before answering.
    { timeout: 120_000 },
  );
  return data;
}
