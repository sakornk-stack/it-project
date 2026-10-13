import type {
  AcademicYear,
  AdminScopeOverviewReport,
  BulkCreateAcademicYearsRequest,
  BulkCreateAcademicYearsResponse,
  CreateAcademicYearRequest,
  CurriculumDashboardReport,
  CreateSemesterRequest,
  InactiveAcademicYear,
  InactiveSemester,
  Semester,
  UpdateAcademicYearRequest,
  UpdateSemesterRequest,
} from '@eduanalyze-ai/shared-types';
import { apiClient } from '../api-client';

export async function createAcademicYear(dto: CreateAcademicYearRequest) {
  const { data } = await apiClient.post<AcademicYear>('/academic-years', dto);
  return data;
}

export async function bulkCreateAcademicYears(dto: BulkCreateAcademicYearsRequest) {
  const { data } = await apiClient.post<BulkCreateAcademicYearsResponse>('/academic-years/bulk', dto);
  return data;
}

export async function updateAcademicYear(id: string, dto: UpdateAcademicYearRequest) {
  const { data } = await apiClient.patch<AcademicYear>(`/academic-years/${id}`, dto);
  return data;
}

export async function deleteAcademicYear(id: string) {
  await apiClient.delete(`/academic-years/${id}`);
}

export async function createSemester(dto: CreateSemesterRequest) {
  const { data } = await apiClient.post<Semester>('/semesters', dto);
  return data;
}

export async function updateSemester(id: string, dto: UpdateSemesterRequest) {
  const { data } = await apiClient.patch<Semester>(`/semesters/${id}`, dto);
  return data;
}

export async function fetchAdminScopeOverview() {
  const { data } = await apiClient.get<AdminScopeOverviewReport>(
    '/dashboard/admin/scope-overview',
  );
  return data;
}

export async function fetchCurriculumQuality(curriculumId: string) {
  const { data } = await apiClient.get<CurriculumDashboardReport>(
    `/dashboard/curriculum/${curriculumId}`,
  );
  return data;
}

export async function deleteSemester(id: string) {
  await apiClient.delete(`/semesters/${id}`);
}

// ---- Deactivated years and semesters (SUPER_ADMIN) ----

export async function fetchInactiveAcademicYears() {
  const { data } = await apiClient.get<InactiveAcademicYear[]>('/academic-years/inactive');
  return data;
}

export async function fetchInactiveSemesters() {
  const { data } = await apiClient.get<InactiveSemester[]>('/semesters/inactive');
  return data;
}

export async function reactivateAcademicYear(id: string) {
  await apiClient.post(`/academic-years/${id}/reactivate`);
}

export async function reactivateSemester(id: string) {
  await apiClient.post(`/semesters/${id}/reactivate`);
}

// Irreversible: only a deactivated record with nothing referencing it (the API says 409 otherwise).
export async function permanentlyDeleteAcademicYear(id: string) {
  await apiClient.delete(`/academic-years/${id}/permanent`);
}

export async function permanentlyDeleteSemester(id: string) {
  await apiClient.delete(`/semesters/${id}/permanent`);
}
