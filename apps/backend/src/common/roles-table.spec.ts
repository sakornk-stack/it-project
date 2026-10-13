import 'reflect-metadata';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './decorators/roles.decorator';
import { StudentInvitationController } from '../modules/auth/student-invitation.controller';
import { CloPloMappingController } from '../modules/curriculum-content/clo-plo-mapping/clo-plo-mapping.controller';
import { CloController } from '../modules/curriculum-content/clo/clo.controller';
import { CourseCategoryController } from '../modules/curriculum-content/course-category/course-category.controller';
import { CourseInstructorController } from '../modules/curriculum-content/course-instructor/course-instructor.controller';
import { CourseController } from '../modules/curriculum-content/course/course.controller';
import { CurriculumRequirementController } from '../modules/curriculum-content/curriculum-requirement/curriculum-requirement.controller';
import { CareerFitController } from '../modules/career-fit/career-fit.controller';
import { PloController } from '../modules/curriculum-content/plo/plo.controller';
import { PrerequisiteController } from '../modules/curriculum-content/prerequisite/prerequisite.controller';
import { StudentCourseRecordController } from '../modules/academic-record/student-course-record/student-course-record.controller';
import { CurriculumController } from '../modules/organization/curriculum/curriculum.controller';
import { DepartmentController } from '../modules/organization/department/department.controller';
import { ProgramController } from '../modules/organization/program/program.controller';

// "Permission table" (TODO.md set 2): pins the @Roles of every write handler
// that was trimmed to least privilege, so a role can't silently creep back in.
type Handlers = Record<string, Role[]>;

const WRITE_STAFF: Handlers = {
  create: ['STAFF'],
  update: ['STAFF'],
  remove: ['STAFF'],
};
const WRITE_SUPER_ADMIN: Handlers = {
  create: ['SUPER_ADMIN'],
  update: ['SUPER_ADMIN'],
  remove: ['SUPER_ADMIN'],
};

const TABLE: [string, { prototype: object }, Handlers][] = [
  ['CourseController', CourseController, WRITE_STAFF],
  ['CourseCategoryController', CourseCategoryController, WRITE_STAFF],
  ['CurriculumRequirementController', CurriculumRequirementController, WRITE_STAFF],
  ['PrerequisiteController', PrerequisiteController, WRITE_STAFF],
  [
    'CourseInstructorController',
    CourseInstructorController,
    { findAll: ['STAFF'], create: ['STAFF'], remove: ['STAFF'] },
  ],
  ['CloController', CloController, WRITE_SUPER_ADMIN],
  ['PloController', PloController, WRITE_SUPER_ADMIN],
  ['CloPloMappingController', CloPloMappingController, WRITE_SUPER_ADMIN],
  ['DepartmentController', DepartmentController, WRITE_SUPER_ADMIN],
  ['ProgramController', ProgramController, WRITE_SUPER_ADMIN],
  ['CurriculumController', CurriculumController, WRITE_SUPER_ADMIN],
  [
    'StudentInvitationController',
    StudentInvitationController,
    { create: ['STAFF'], resend: ['STAFF'], findAll: ['STAFF', 'ADMIN', 'SUPER_ADMIN'] },
  ],
  [
    'StudentCourseRecordController',
    StudentCourseRecordController,
    {
      create: ['STUDENT', 'STAFF'],
      update: ['STUDENT', 'STAFF', 'INSTRUCTOR'],
      remove: ['STUDENT', 'STAFF', 'INSTRUCTOR'],
      // Reads stay open to SUPER_ADMIN/ADMIN.
      findAll: ['STUDENT', 'SUPER_ADMIN', 'ADMIN', 'STAFF'],
      findOne: ['STUDENT', 'SUPER_ADMIN', 'ADMIN', 'STAFF'],
    },
  ],
  ['CareerFitController', CareerFitController, { getMyCareerFit: ['STUDENT'] }],
];

describe('role permission table', () => {
  describe.each(TABLE)('%s', (_name, controller, handlers) => {
    it.each(Object.entries(handlers))('%s allows exactly its listed roles', (method, expected) => {
      const handler = (controller.prototype as Record<string, unknown>)[method] as object;
      expect(handler).toBeDefined();
      const roles = Reflect.getMetadata(ROLES_KEY, handler) as Role[];
      expect([...roles].sort()).toEqual([...expected].sort());
    });
  });
});
