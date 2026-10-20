import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { SCOPE_TARGET_KEY } from '../../common/decorators/scope-target.decorator';
import { ScopeGuard } from '../../common/guards/scope.guard';
import { ScopeResolverService } from '../../common/scope/scope-resolver.service';
import { CourseCategoryController } from './course-category/course-category.controller';
import { CourseController } from './course/course.controller';
import { CurriculumRequirementController } from './curriculum-requirement/curriculum-requirement.controller';
import { PrerequisiteController } from './prerequisite/prerequisite.controller';

// STAFF writes to the curriculum catalogue are checked against the target's
// program by ScopeGuard. Two halves: every write handler carries the guard and
// a scope target, and the guard refuses a STAFF user whose scope does not cover it.

const handlerOf = (controller: { prototype: object }, method: string) =>
  (controller.prototype as Record<string, unknown>)[method] as object;

const WRITES: [string, { prototype: object }, string, string, string, string][] = [
  ['CourseController', CourseController, 'create', 'curriculum', 'body', 'curriculumId'],
  ['CourseController', CourseController, 'update', 'course', 'param', 'id'],
  ['CourseController', CourseController, 'remove', 'course', 'param', 'id'],
  ['CourseController', CourseController, 'reactivate', 'course', 'param', 'id'],
  [
    'CourseCategoryController',
    CourseCategoryController,
    'create',
    'curriculum',
    'body',
    'curriculumId',
  ],
  ['CourseCategoryController', CourseCategoryController, 'update', 'courseCategory', 'param', 'id'],
  ['CourseCategoryController', CourseCategoryController, 'remove', 'courseCategory', 'param', 'id'],
  [
    'CurriculumRequirementController',
    CurriculumRequirementController,
    'create',
    'curriculum',
    'body',
    'curriculumId',
  ],
  [
    'CurriculumRequirementController',
    CurriculumRequirementController,
    'update',
    'curriculumRequirement',
    'param',
    'id',
  ],
  [
    'CurriculumRequirementController',
    CurriculumRequirementController,
    'remove',
    'curriculumRequirement',
    'param',
    'id',
  ],
  ['PrerequisiteController', PrerequisiteController, 'create', 'course', 'body', 'courseId'],
  ['PrerequisiteController', PrerequisiteController, 'update', 'prerequisite', 'param', 'id'],
  ['PrerequisiteController', PrerequisiteController, 'remove', 'prerequisite', 'param', 'id'],
];

describe('catalogue write handlers are STAFF + ScopeGuard', () => {
  it.each(WRITES)('%s.%s targets %s from %s.%s', (_n, controller, method, entity, from, key) => {
    const handler = handlerOf(controller, method);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['STAFF']);
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(ScopeGuard);
    expect(Reflect.getMetadata(SCOPE_TARGET_KEY, handler)).toEqual({
      entity,
      source: { from, key },
    });
  });

  it('the deactivated-course list is STAFF only and filtered by CatalogScopeService', () => {
    const handler = handlerOf(CourseController, 'findInactive');
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['STAFF']);
  });
});

describe('ScopeGuard on a catalogue write', () => {
  const COURSE_TARGET = { facultyId: 'f1', departmentId: 'd1', programId: 'p1' };

  function run(
    roles: string[],
    scopes: { level: string; facultyId?: string; departmentId?: string; programId?: string }[],
  ) {
    const resolver = new ScopeResolverService({} as never);
    jest.spyOn(resolver, 'resolveAncestry').mockResolvedValue(COURSE_TARGET as never);
    const effective = jest
      .spyOn(resolver, 'getEffectiveScopes')
      .mockResolvedValue(
        scopes.map((s) => ({
          facultyId: null,
          departmentId: null,
          programId: null,
          ...s,
        })) as never,
      );
    const guard = new ScopeGuard(new Reflector(), resolver);
    const handler = handlerOf(CourseController, 'reactivate');
    const context = {
      getHandler: () => handler,
      getClass: () => CourseController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { userId: 'u1', roles }, params: { id: 'c1' }, body: {} }),
      }),
    } as unknown as ExecutionContext;
    return { result: guard.canActivate(context), resolver, effective };
  }

  it('refuses STAFF scoped to another program (403)', async () => {
    const { result } = run(['STAFF'], [{ level: 'PROGRAM', programId: 'p-other' }]);
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses STAFF with no scope at all (403)', async () => {
    const { result } = run(['STAFF'], []);
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses STAFF scoped to another faculty (403)', async () => {
    const { result } = run(['STAFF'], [{ level: 'FACULTY', facultyId: 'f-other' }]);
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ['program', { level: 'PROGRAM', programId: 'p1' }],
    ['department', { level: 'DEPARTMENT', departmentId: 'd1' }],
    ['faculty', { level: 'FACULTY', facultyId: 'f1' }],
  ])('allows STAFF whose %s scope covers the course', async (_n, scope) => {
    const { result, resolver } = run(['STAFF'], [scope]);
    await expect(result).resolves.toBe(true);
    expect(resolver.resolveAncestry).toHaveBeenCalledWith('course', 'c1');
  });
});
