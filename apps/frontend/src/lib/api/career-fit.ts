import type { CareerFitReport } from '@eduanalyze-ai/shared-types';
import { apiClient } from '../api-client';

export async function fetchMyCareerFit() {
  const { data } = await apiClient.get<CareerFitReport>('/students/me/career-fit');
  return data;
}
