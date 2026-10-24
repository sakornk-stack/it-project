import type { AdviseeDetail, AdviseeSummary } from '@eduanalyze-ai/shared-types';
import { apiClient } from '../api-client';

// The caller's own advisees (INSTRUCTOR, read-only). Any other student is a 404.
export async function fetchAdvisees() {
  const { data } = await apiClient.get<AdviseeSummary[]>('/advisor/students');
  return data;
}

export async function fetchAdvisee(id: string) {
  const { data } = await apiClient.get<AdviseeDetail>(`/advisor/students/${id}`);
  return data;
}
