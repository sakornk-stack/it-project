import type {
  StudentProfileDetail,
  UpdateStudentProfileRequest,
} from '@eduanalyze-ai/shared-types';

// Same rule as the API (StudentProfileService.requireReason): a reason of at
// least 5 characters once surrounding spaces are dropped.
export const REASON_MIN_LENGTH = 5;

export function reasonIsLongEnough(reason: string): boolean {
  return reason.trim().length >= REASON_MIN_LENGTH;
}

// Suspended if either switch is off, so a half-suspended account (older data)
// is offered "reactivate", which turns both back on.
export function isStudentSuspended(profile: Pick<StudentProfileDetail, 'isActive' | 'user'>) {
  return !profile.isActive || !profile.user.isActive;
}

// Only the fields the user actually changed go to the API; the reason always
// does. null when nothing changed.
export function buildProfileUpdate(
  profile: Pick<StudentProfileDetail, 'programId' | 'curriculumId' | 'admissionYear'>,
  values: { programId: string; curriculumId: string; admissionYear: number; reason: string },
): UpdateStudentProfileRequest | null {
  const dto: UpdateStudentProfileRequest = { reason: values.reason.trim() };
  if (values.programId !== profile.programId) dto.programId = values.programId;
  if (values.curriculumId !== profile.curriculumId) dto.curriculumId = values.curriculumId;
  if (values.admissionYear !== profile.admissionYear) dto.admissionYear = values.admissionYear;
  return Object.keys(dto).length > 1 ? dto : null;
}
