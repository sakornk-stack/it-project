import type {
  CreateCurriculumRequest,
  CreateDepartmentRequest,
  CreateFacultyRequest,
  CreateProgramRequest,
  CurriculumListItem,
  DepartmentListItem,
  FacultyListItem,
  InactiveDepartmentListItem,
  InactiveFacultyListItem,
  InactiveProgramListItem,
  ProgramListItem,
  UpdateCurriculumRequest,
  UpdateDepartmentRequest,
  UpdateFacultyRequest,
  UpdateProgramRequest,
} from '@eduanalyze-ai/shared-types';
import { apiClient } from '../api-client';

// All 4 reads are public (no auth) — see the backend organization controllers'
// "Public — university org structure..." comment. No query-param
// filtering exists server-side (confirmed by reading the services), so
// each is fetched once in full and filtered client-side as the user
// picks a parent — see components/auth/dependent-org-select.tsx.

export async function fetchFaculties() {
  const { data } = await apiClient.get<FacultyListItem[]>('/faculties');
  return data;
}

export async function fetchDepartments() {
  const { data } = await apiClient.get<DepartmentListItem[]>('/departments');
  return data;
}

export async function fetchPrograms() {
  const { data } = await apiClient.get<ProgramListItem[]>('/programs');
  return data;
}

export async function fetchCurricula() {
  const { data } = await apiClient.get<CurriculumListItem[]>('/curricula');
  return data;
}

// ---- Writes (SUPER_ADMIN org management) ----

export async function createFaculty(body: CreateFacultyRequest) {
  const { data } = await apiClient.post<FacultyListItem>('/faculties', body);
  return data;
}

export async function updateFaculty(id: string, body: UpdateFacultyRequest) {
  const { data } = await apiClient.patch<FacultyListItem>(`/faculties/${id}`, body);
  return data;
}

export async function deleteFaculty(id: string) {
  await apiClient.delete(`/faculties/${id}`);
}

export async function createDepartment(body: CreateDepartmentRequest) {
  const { data } = await apiClient.post<DepartmentListItem>('/departments', body);
  return data;
}

export async function updateDepartment(id: string, body: UpdateDepartmentRequest) {
  const { data } = await apiClient.patch<DepartmentListItem>(`/departments/${id}`, body);
  return data;
}

export async function deleteDepartment(id: string) {
  await apiClient.delete(`/departments/${id}`);
}

export async function createProgram(body: CreateProgramRequest) {
  const { data } = await apiClient.post<ProgramListItem>('/programs', body);
  return data;
}

export async function updateProgram(id: string, body: UpdateProgramRequest) {
  const { data } = await apiClient.patch<ProgramListItem>(`/programs/${id}`, body);
  return data;
}

export async function deleteProgram(id: string) {
  await apiClient.delete(`/programs/${id}`);
}

export async function createCurriculum(body: CreateCurriculumRequest) {
  const { data } = await apiClient.post<CurriculumListItem>('/curricula', body);
  return data;
}

export async function updateCurriculum(id: string, body: UpdateCurriculumRequest) {
  const { data } = await apiClient.patch<CurriculumListItem>(`/curricula/${id}`, body);
  return data;
}

export async function deleteCurriculum(id: string) {
  await apiClient.delete(`/curricula/${id}`);
}

// ---- Deactivated records (SUPER_ADMIN): list them and restore one ----

export async function fetchInactiveFaculties() {
  const { data } = await apiClient.get<InactiveFacultyListItem[]>('/faculties/inactive');
  return data;
}

export async function fetchInactiveDepartments() {
  const { data } = await apiClient.get<InactiveDepartmentListItem[]>('/departments/inactive');
  return data;
}

export async function fetchInactivePrograms() {
  const { data } = await apiClient.get<InactiveProgramListItem[]>('/programs/inactive');
  return data;
}

export async function fetchInactiveCurricula() {
  const { data } = await apiClient.get<CurriculumListItem[]>('/curricula/inactive');
  return data;
}

export type ReactivatableOrgResource = 'faculties' | 'departments' | 'programs' | 'curricula';

export async function reactivateOrgRecord(resource: ReactivatableOrgResource, id: string) {
  await apiClient.post(`/${resource}/${id}/reactivate`);
}

// Faculties, departments and programs only: curricula have no permanent delete here.
export type PermanentlyDeletableOrgResource = Exclude<ReactivatableOrgResource, 'curricula'>;

export async function permanentlyDeleteOrgRecord(
  resource: PermanentlyDeletableOrgResource,
  id: string,
) {
  await apiClient.delete(`/${resource}/${id}/permanent`);
}
