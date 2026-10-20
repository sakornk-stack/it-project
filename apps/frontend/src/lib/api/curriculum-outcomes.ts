import type {
  CloDetail,
  CloPloMappingItem,
  CreateCloPloMappingRequest,
  CreateCloRequest,
  CreatePloRequest,
  PloListItem,
  UpdateCloPloMappingRequest,
  UpdateCloRequest,
  UpdatePloRequest,
} from '@eduanalyze-ai/shared-types';
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

// ---- PLO of a curriculum (ADMIN) ----

export async function fetchCurriculumPlos(curriculumId: string) {
  const { data } = await apiClient.get<PloListItem[]>('/plos', { params: { curriculumId } });
  return data;
}

export async function createPlo(dto: CreatePloRequest) {
  const { data } = await apiClient.post<PloListItem>('/plos', dto);
  return data;
}

export async function updatePlo(id: string, dto: UpdatePloRequest) {
  const { data } = await apiClient.patch<PloListItem>(`/plos/${id}`, dto);
  return data;
}

// Soft delete: refused (409) while CLO links exist.
export async function deletePlo(id: string) {
  await apiClient.delete(`/plos/${id}`);
}

// ---- CLO-PLO links (ADMIN) ----

export async function fetchCurriculumMappings(curriculumId: string) {
  const { data } = await apiClient.get<CloPloMappingItem[]>('/clo-plo-mappings', {
    params: { curriculumId },
  });
  return data;
}

export async function createMapping(dto: CreateCloPloMappingRequest) {
  const { data } = await apiClient.post<CloPloMappingItem>('/clo-plo-mappings', dto);
  return data;
}

export async function updateMapping(id: string, dto: UpdateCloPloMappingRequest) {
  const { data } = await apiClient.patch<CloPloMappingItem>(`/clo-plo-mappings/${id}`, dto);
  return data;
}

export async function deleteMapping(id: string) {
  await apiClient.delete(`/clo-plo-mappings/${id}`);
}
