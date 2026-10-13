import type {
  AdminUserSummary,
  AssignRoleRequest,
  CreateUserRequest,
  CreateUserResponse,
  CreateUserScopeRequest,
  UpdateUserActiveStatusRequest,
} from '@eduanalyze-ai/shared-types';
import { apiClient } from '../api-client';

export async function fetchUsers() {
  const { data } = await apiClient.get<AdminUserSummary[]>('/users');
  return data;
}

export async function fetchUser(id: string) {
  const { data } = await apiClient.get<AdminUserSummary>(`/users/${id}`);
  return data;
}

export async function createUser(dto: CreateUserRequest) {
  const { data } = await apiClient.post<CreateUserResponse>('/users', dto);
  return data;
}

export async function updateUserActiveStatus(id: string, dto: UpdateUserActiveStatusRequest) {
  await apiClient.patch(`/users/${id}/active-status`, dto);
}

export async function assignUserRole(id: string, dto: AssignRoleRequest) {
  await apiClient.post(`/users/${id}/roles`, dto);
}

export async function revokeUserRole(id: string, role: string) {
  await apiClient.delete(`/users/${id}/roles/${role}`);
}

export async function createUserScope(userId: string, dto: CreateUserScopeRequest) {
  await apiClient.post(`/users/${userId}/scopes`, dto);
}

export async function deleteUserScope(userId: string, scopeId: string) {
  await apiClient.delete(`/users/${userId}/scopes/${scopeId}`);
}

export async function resendInvitation(id: string) {
  await apiClient.post(`/users/${id}/resend-invitation`);
}

export async function deleteUserPermanently(id: string) {
  await apiClient.delete(`/users/${id}/permanent`);
}
