import {
  Clo,
  Course,
  CourseCategory,
  CurriculumRequirement,
  Prerequisite,
  Prisma,
} from '@prisma/client';
import type { AuditSnapshot } from '../../common/audit/audit-log.util';

// Allow-listed before/after snapshots for the curriculum catalogue audit rows
// (CONVENTIONS §11). Plain, flat values only; a course's description is left out
// because it is long free text and not needed to see what changed.

export function courseSnapshot(course: Course): AuditSnapshot {
  return {
    code: course.code,
    name: course.name,
    nameEn: course.nameEn,
    credits: course.credits,
    isRequired: course.isRequired,
    categoryId: course.categoryId,
    curriculumId: course.curriculumId,
    isActive: course.isActive,
  };
}

export function courseCategorySnapshot(category: CourseCategory): AuditSnapshot {
  return {
    name: category.name,
    code: category.code,
    curriculumId: category.curriculumId,
    isActive: category.isActive,
  };
}

export function curriculumRequirementSnapshot(requirement: CurriculumRequirement): AuditSnapshot {
  return {
    curriculumId: requirement.curriculumId,
    categoryId: requirement.categoryId,
    minCredits: requirement.minCredits,
    minCourses: requirement.minCourses,
  };
}

export function prerequisiteSnapshot(prerequisite: Prerequisite): AuditSnapshot {
  return {
    courseId: prerequisite.courseId,
    prerequisiteCourseId: prerequisite.prerequisiteCourseId,
    groupId: prerequisite.groupId,
  };
}

export function cloSnapshot(clo: Clo): AuditSnapshot {
  return {
    code: clo.code,
    description: clo.description,
    achievementThreshold: clo.achievementThreshold,
    isConfirmed: clo.isConfirmed,
    courseId: clo.courseId,
    isActive: clo.isActive,
  };
}

// AuditLog.programId is required: every catalogue row belongs to one curriculum,
// and its program at the time of the change is what gets stored.
export async function curriculumProgramId(
  tx: Prisma.TransactionClient,
  curriculumId: string,
): Promise<string> {
  const curriculum = await tx.curriculum.findUniqueOrThrow({
    where: { id: curriculumId },
    select: { programId: true },
  });
  return curriculum.programId;
}
