import 'reflect-metadata';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './decorators/roles.decorator';
import { AiAnalysisController } from '../modules/ai-analysis/ai-analysis.controller';
import { CreditCheckerController } from '../modules/academic-record/credit-checker/credit-checker.controller';
import { LearningPathController } from '../modules/academic-record/learning-path/learning-path.controller';
import { CourseStudentsController } from '../modules/academic-record/student-course-record/course-students.controller';
import { CloAchievementController } from '../modules/curriculum-content/clo-achievement/clo-achievement.controller';
import { PloAchievementController } from '../modules/curriculum-content/plo-achievement/plo-achievement.controller';
import { ActualAchievementController } from '../modules/curriculum-content/assessment-evidence/actual-achievement.controller';
import { AssessmentCloMappingController } from '../modules/curriculum-content/assessment-evidence/assessment-clo-mapping.controller';
import { AssessmentDefinitionController } from '../modules/curriculum-content/assessment-evidence/assessment-definition.controller';
import { StudentAssessmentScoreController } from '../modules/curriculum-content/assessment-evidence/student-assessment-score.controller';
import { CourseAssessmentController } from '../modules/curriculum-content/course-assessment/course-assessment.controller';
import { DashboardController } from '../modules/dashboard/dashboard.controller';
import { StudentProfilesController } from '../modules/users/student-profile/student-profiles.controller';
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
import { UserManagementController } from '../modules/users/user-management/user-management.controller';
import { CurriculumController } from '../modules/organization/curriculum/curriculum.controller';
import { FacultyController } from '../modules/organization/faculty/faculty.controller';
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
// Academic content (curricula, CLO, PLO, mappings) is written by ADMIN within their scope;
// SUPER_ADMIN only manages accounts, organisation structure and the academic calendar.
const WRITE_ADMIN: Handlers = {
  create: ['ADMIN'],
  update: ['ADMIN'],
  remove: ['ADMIN'],
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
  ['CloController', CloController, WRITE_ADMIN],
  ['PloController', PloController, WRITE_ADMIN],
  ['CloPloMappingController', CloPloMappingController, WRITE_ADMIN],
  // Permanent delete of faculties/departments/programs: SUPER_ADMIN only. Curricula have none.
  ['FacultyController', FacultyController, { ...WRITE_SUPER_ADMIN, hardDelete: ['SUPER_ADMIN'] }],
  ['DepartmentController', DepartmentController, { ...WRITE_SUPER_ADMIN, hardDelete: ['SUPER_ADMIN'] }],
  ['ProgramController', ProgramController, { ...WRITE_SUPER_ADMIN, hardDelete: ['SUPER_ADMIN'] }],
  ['CurriculumController', CurriculumController, WRITE_ADMIN],
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
      // Reads stay open to ADMIN/STAFF; SUPER_ADMIN has no access to grades.
      findAll: ['STUDENT', 'ADMIN', 'STAFF'],
      findOne: ['STUDENT', 'ADMIN', 'STAFF'],
    },
  ],
  ['CareerFitController', CareerFitController, { getMyCareerFit: ['STUDENT'] }],
  // Permanent delete of an account: SUPER_ADMIN only, never ADMIN.
  ['UserManagementController', UserManagementController, { hardDelete: ['SUPER_ADMIN'] }],
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

// SUPER_ADMIN manages accounts only: no handler of an academic-content controller may list it.
const ACADEMIC_CONTROLLERS: [string, { prototype: object }][] = [
  ['AiAnalysisController', AiAnalysisController],
  ['CreditCheckerController', CreditCheckerController],
  ['LearningPathController', LearningPathController],
  ['CourseStudentsController', CourseStudentsController],
  ['CloAchievementController', CloAchievementController],
  ['PloAchievementController', PloAchievementController],
  ['ActualAchievementController', ActualAchievementController],
  ['AssessmentCloMappingController', AssessmentCloMappingController],
  ['AssessmentDefinitionController', AssessmentDefinitionController],
  ['StudentAssessmentScoreController', StudentAssessmentScoreController],
  ['CourseAssessmentController', CourseAssessmentController],
  ['DashboardController', DashboardController],
  ['StudentProfilesController', StudentProfilesController],
  ['StudentCourseRecordController', StudentCourseRecordController],
  ['CloController', CloController],
  ['PloController', PloController],
  ['CloPloMappingController', CloPloMappingController],
  ['CurriculumController', CurriculumController],
  ['CareerFitController', CareerFitController],
];

describe('SUPER_ADMIN has no access to academic data', () => {
  describe.each(ACADEMIC_CONTROLLERS)('%s', (_name, controller) => {
    it('lists no handler with SUPER_ADMIN', () => {
      const proto = controller.prototype as Record<string, unknown>;
      const offenders = Object.getOwnPropertyNames(proto).filter((key) => {
        const handler = proto[key];
        if (typeof handler !== 'function') return false;
        const roles = Reflect.getMetadata(ROLES_KEY, handler as object) as Role[] | undefined;
        return !!roles?.includes('SUPER_ADMIN');
      });
      expect(offenders).toEqual([]);
    });
  });
});
