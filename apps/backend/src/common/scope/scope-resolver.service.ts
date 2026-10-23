import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ScopeLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ScopeTargetEntity } from '../decorators/scope-target.decorator';

export interface ScopeAncestry {
  facultyId: string | null;
  departmentId: string | null;
  programId: string | null;
}

// Every entity that sits below Program in the hierarchy and therefore
// resolves by finding its own programId first.
type ProgramDerivedEntity = Exclude<
  ScopeTargetEntity,
  'faculty' | 'department' | 'program'
>;

export interface EffectiveScope {
  level: ScopeLevel;
  facultyId: string | null;
  departmentId: string | null;
  programId: string | null;
}

// Leaf provider — depends only on PrismaService (global), never on
// DepartmentModule/ProgramModule/UserScopeModule, so ScopeModule can be
// imported back into those modules without a circular dependency.
@Injectable()
export class ScopeResolverService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly LEVEL_TO_ENTITY: Record<ScopeLevel, ScopeTargetEntity> = {
    FACULTY: 'faculty',
    DEPARTMENT: 'department',
    PROGRAM: 'program',
  };

  // Small convenience over resolveAncestry for callers that only have a
  // ScopeLevel (e.g. UserScope's level column) rather than a statically
  // known ScopeTargetEntity — avoids the FACULTY/DEPARTMENT/PROGRAM →
  // faculty/department/program mapping being re-derived in every caller
  // (Module 12's UserManagementService and UserScopeService both need it).
  async resolveAncestryForLevel(
    level: ScopeLevel,
    id: string,
  ): Promise<ScopeAncestry> {
    return this.resolveAncestry(ScopeResolverService.LEVEL_TO_ENTITY[level], id);
  }

  async resolveAncestry(
    entity: ScopeTargetEntity,
    id: string,
  ): Promise<ScopeAncestry> {
    this.assertResolvableId(entity, id);

    if (entity === 'faculty') {
      return { facultyId: id, departmentId: null, programId: null };
    }
    if (entity === 'department') {
      return this.resolveDepartmentAncestry(id);
    }
    if (entity === 'program') {
      return this.resolveProgramAncestry(id);
    }
    return this.resolveViaProgram(entity, id);
  }

  // ScopeGuard passes body[key] straight through when the DTO is
  // malformed (guards run before ValidationPipe in the Nest pipeline —
  // it hasn't rejected a missing/wrong-typed field yet at this point).
  // Without this check, `id: undefined` reaches a Prisma findUnique
  // below and Prisma throws PrismaClientValidationError, which
  // AllExceptionsFilter only has a generic 500 for — the caller should
  // get a 400 telling them the field is missing, not an opaque 500.
  private assertResolvableId(
    entity: ScopeTargetEntity,
    id: string,
  ): asserts id is string {
    if (!id || typeof id !== 'string') {
      throw new BadRequestException(
        `Missing or invalid ${entity} id for scope resolution`,
      );
    }
  }

  private async resolveDepartmentAncestry(id: string): Promise<ScopeAncestry> {
    const department = await this.prisma.department.findUnique({
      where: { id },
      select: { facultyId: true },
    });
    if (!department) {
      throw new NotFoundException(`Department ${id} not found`);
    }
    return { facultyId: department.facultyId, departmentId: id, programId: null };
  }

  private async resolveProgramAncestry(id: string): Promise<ScopeAncestry> {
    const program = await this.prisma.program.findUnique({
      where: { id },
      include: { department: { select: { facultyId: true } } },
    });
    if (!program) {
      throw new NotFoundException(`Program ${id} not found`);
    }
    return {
      facultyId: program.department.facultyId,
      departmentId: program.departmentId,
      programId: id,
    };
  }

  // Everything below Program resolves to its own programId with one query
  // and then delegates to the program walk-up above — reuse over
  // duplicating the Department/Faculty walk (CONVENTIONS §6), at the cost
  // of one extra query per resolution (single-row mutation-time lookups,
  // not a list endpoint, so this is cheap).
  //
  // Keyed by entity so the ScopeTargetEntity union and this table have to
  // stay in step: adding a member without a lookup here is a compile
  // error. `label` is the exact NotFoundException wording each entity
  // already used and is deliberately inconsistent (`Student profile` vs
  // `CloPloMapping`) — callers may match on it.
  private programDerivedLookup(
    entity: ProgramDerivedEntity,
  ): { label: string; findProgramId: (id: string) => Promise<string | null> } {
    const lookups: Record<
      ProgramDerivedEntity,
      { label: string; findProgramId: (id: string) => Promise<string | null> }
    > = {
      curriculum: {
        label: 'Curriculum',
        findProgramId: async (id) =>
          (
            await this.prisma.curriculum.findUnique({
              where: { id },
              select: { programId: true },
            })
          )?.programId ?? null,
      },
      course: {
        label: 'Course',
        findProgramId: async (id) =>
          (
            await this.prisma.course.findUnique({
              where: { id },
              select: { curriculum: { select: { programId: true } } },
            })
          )?.curriculum.programId ?? null,
      },
      plo: {
        label: 'Plo',
        findProgramId: async (id) =>
          (
            await this.prisma.plo.findUnique({
              where: { id },
              select: { curriculum: { select: { programId: true } } },
            })
          )?.curriculum.programId ?? null,
      },
      clo: {
        label: 'Clo',
        findProgramId: async (id) =>
          (
            await this.prisma.clo.findUnique({
              where: { id },
              select: {
                course: { select: { curriculum: { select: { programId: true } } } },
              },
            })
          )?.course.curriculum.programId ?? null,
      },
      cloPloMapping: {
        label: 'CloPloMapping',
        findProgramId: async (id) =>
          (
            await this.prisma.cloPloMapping.findUnique({
              where: { id },
              select: {
                plo: { select: { curriculum: { select: { programId: true } } } },
              },
            })
          )?.plo.curriculum.programId ?? null,
      },
      courseCategory: {
        label: 'CourseCategory',
        findProgramId: async (id) =>
          (
            await this.prisma.courseCategory.findUnique({
              where: { id },
              select: { curriculum: { select: { programId: true } } },
            })
          )?.curriculum.programId ?? null,
      },
      curriculumRequirement: {
        label: 'CurriculumRequirement',
        findProgramId: async (id) =>
          (
            await this.prisma.curriculumRequirement.findUnique({
              where: { id },
              select: { curriculum: { select: { programId: true } } },
            })
          )?.curriculum.programId ?? null,
      },
      prerequisite: {
        label: 'Prerequisite',
        findProgramId: async (id) =>
          (
            await this.prisma.prerequisite.findUnique({
              where: { id },
              select: {
                course: { select: { curriculum: { select: { programId: true } } } },
              },
            })
          )?.course.curriculum.programId ?? null,
      },
      // StudentProfile has a direct programId column (no curriculum hop),
      // unlike every other entry here.
      studentProfile: {
        label: 'Student profile',
        findProgramId: async (id) =>
          (
            await this.prisma.studentProfile.findUnique({
              where: { id },
              select: { programId: true },
            })
          )?.programId ?? null,
      },
      studentInvitation: {
        label: 'Student invitation',
        findProgramId: async (id) =>
          (
            await this.prisma.studentInvitation.findUnique({
              where: { id },
              select: { programId: true },
            })
          )?.programId ?? null,
      },
    };
    return lookups[entity];
  }

  private async resolveViaProgram(
    entity: ProgramDerivedEntity,
    id: string,
  ): Promise<ScopeAncestry> {
    const { label, findProgramId } = this.programDerivedLookup(entity);
    const programId = await findProgramId(id);
    if (programId === null) {
      throw new NotFoundException(`${label} ${id} not found`);
    }
    return this.resolveProgramAncestry(programId);
  }

  // Resolves scope live per CONVENTIONS.md §8 — a UserScope row pointing
  // at a since soft-deleted Faculty/Department/Program must not count.
  async getEffectiveScopes(userId: string): Promise<EffectiveScope[]> {
    const scopes = await this.prisma.userScope.findMany({
      where: { userId },
      include: { faculty: true, department: true, program: true },
    });

    return scopes
      .filter(
        (scope) =>
          scope.faculty?.isActive !== false &&
          scope.department?.isActive !== false &&
          scope.program?.isActive !== false,
      )
      .map((scope) => ({
        level: scope.level,
        facultyId: scope.facultyId,
        departmentId: scope.departmentId,
        programId: scope.programId,
      }));
  }

  // A UserScope row fills only the column for its own level (a PROGRAM row
  // has facultyId/departmentId null), so it must be resolved to its full
  // ancestry before isCovered — otherwise a FACULTY- or DEPARTMENT-level
  // ADMIN never covers a user whose scope is a program or department under it.
  async resolveScopeRowAncestry(scope: {
    level: ScopeLevel;
    facultyId: string | null;
    departmentId: string | null;
    programId: string | null;
  }): Promise<ScopeAncestry> {
    const id =
      scope.level === 'FACULTY'
        ? scope.facultyId
        : scope.level === 'DEPARTMENT'
          ? scope.departmentId
          : scope.programId;
    return this.resolveAncestryForLevel(scope.level, id as string);
  }

  // Hierarchical containment check — FACULTY scope covers every child
  // Department/Program, DEPARTMENT scope covers every child Program.
  // Shared by ScopeGuard and by Module 12's user-creation/scope-granting
  // logic so the hierarchy rule lives in exactly one place.
  isCovered(target: ScopeAncestry, effectiveScopes: EffectiveScope[]): boolean {
    return effectiveScopes.some(
      (scope) =>
        (scope.level === 'FACULTY' && scope.facultyId === target.facultyId) ||
        (scope.level === 'DEPARTMENT' &&
          scope.departmentId === target.departmentId) ||
        (scope.level === 'PROGRAM' && scope.programId === target.programId),
    );
  }

  // For query-level list filtering (CONVENTIONS §3a: never fetch-all-then-
  // filter-in-memory) — expands effective scopes down to concrete Program
  // ids, since a FACULTY/DEPARTMENT-level scope covers every Program under
  // it, not just a literal programId column.
  async getCoveredProgramIds(userId: string): Promise<string[]> {
    const effectiveScopes = await this.getEffectiveScopes(userId);
    const programIds = new Set<string>();

    for (const scope of effectiveScopes) {
      if (scope.level === 'PROGRAM') {
        programIds.add(scope.programId!);
      } else if (scope.level === 'DEPARTMENT') {
        const programs = await this.prisma.program.findMany({
          where: { departmentId: scope.departmentId!, isActive: true },
          select: { id: true },
        });
        programs.forEach((p) => programIds.add(p.id));
      } else if (scope.level === 'FACULTY') {
        const programs = await this.prisma.program.findMany({
          where: { department: { facultyId: scope.facultyId! }, isActive: true },
          select: { id: true },
        });
        programs.forEach((p) => programIds.add(p.id));
      }
    }

    return [...programIds];
  }

  // For query-level filtering of *Users* by their own UserScope rows (as
  // opposed to getCoveredProgramIds, which filters Program-derived records
  // like StudentProfile/Curriculum) — matches a target user whose own scope
  // is covered by the requester's effective scope. Expands each requester
  // scope into the 3-way nested clause needed because UserScope's
  // facultyId/departmentId/programId are XOR'd — a DEPARTMENT-level scope
  // has facultyId: null, so it must also match child Programs via
  // program.departmentId, not just departmentId directly. Genuinely
  // query-level per CONVENTIONS §3a: the DB does the user filtering, this
  // only pre-computes the WHERE clause from the requester's own small
  // scope set.
  async buildUserScopeOrFilter(
    requesterId: string,
  ): Promise<Prisma.UserScopeWhereInput[]> {
    const effectiveScopes = await this.getEffectiveScopes(requesterId);

    // Non-null assertions below are safe by the XOR invariant UserScope is
    // constructed under (UserScopeService.assignScope): a FACULTY-level
    // row always has facultyId set, a DEPARTMENT-level row always has
    // departmentId set, etc. — TS can't infer that from the `level` branch
    // alone since EffectiveScope's fields are independently `string | null`.
    return effectiveScopes.flatMap((scope): Prisma.UserScopeWhereInput[] => {
      if (scope.level === 'FACULTY') {
        return [
          { level: 'FACULTY', facultyId: scope.facultyId! },
          { level: 'DEPARTMENT', department: { facultyId: scope.facultyId! } },
          {
            level: 'PROGRAM',
            program: { department: { facultyId: scope.facultyId! } },
          },
        ];
      }
      if (scope.level === 'DEPARTMENT') {
        return [
          { level: 'DEPARTMENT', departmentId: scope.departmentId! },
          { level: 'PROGRAM', program: { departmentId: scope.departmentId! } },
        ];
      }
      return [{ level: 'PROGRAM', programId: scope.programId! }];
    });
  }
}
