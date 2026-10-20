import type { CloDetail, CreateCloRequest, UpdateCloRequest } from '@eduanalyze-ai/shared-types';
import { apiClient } from '../api-client';

// ADMIN: the active CLOs of one course (the server also limits them to the caller's scope).
export async function fetchCourseClos(courseId: string) {
  const { data } = await apiClient.get<CloDetail[]>('/clos', { params: { courseId } });
  return data;
}

export async function createClo(dto: CreateCloRequest) {
  const { data } = await apiClient.post<CloDetail>('/clos', dto);
  return data;
}

export async function updateClo(id: string, dto: UpdateCloRequest) {
  const { data } = await apiClient.patch<CloDetail>(`/clos/${id}`, dto);
  return data;
}

// Soft delete: the CLO is deactivated, and refused (409) while PLO links or scores exist.
export async function deleteClo(id: string) {
  await apiClient.delete(`/clos/${id}`);
}
