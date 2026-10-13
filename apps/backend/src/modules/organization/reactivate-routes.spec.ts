import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { AcademicYearController } from '../academic-record/academic-year/academic-year.controller';
import { SemesterController } from '../academic-record/semester/semester.controller';
import { CurriculumController } from './curriculum/curriculum.controller';
import { DepartmentController } from './department/department.controller';
import { FacultyController } from './faculty/faculty.controller';
import { ProgramController } from './program/program.controller';

// Reactivating is a SUPER_ADMIN-only act for every organisation and academic-calendar record.
describe.each([
  ['faculties', FacultyController],
  ['departments', DepartmentController],
  ['programs', ProgramController],
  ['academic years', AcademicYearController],
  ['semesters', SemesterController],
])('%s reactivation routes', (_name, controller) => {
  it.each(['findInactive', 'reactivate'])('%s is SUPER_ADMIN only', (method) => {
    const handler = (controller.prototype as unknown as Record<string, () => void>)[method];
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['SUPER_ADMIN']);
  });
});

// Curricula are academic content, so reactivating one belongs to ADMIN, not SUPER_ADMIN.
describe('curricula reactivation routes', () => {
  it.each(['findInactive', 'reactivate'])('%s is ADMIN only', (method) => {
    const handler = (CurriculumController.prototype as unknown as Record<string, () => void>)[
      method
    ];
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['ADMIN']);
  });
});
