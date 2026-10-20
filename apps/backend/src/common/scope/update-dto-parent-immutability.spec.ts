import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateCloDto } from '../../modules/curriculum-content/clo/dto/update-clo.dto';
import { UpdateCourseCategoryDto } from '../../modules/curriculum-content/course-category/dto/update-course-category.dto';
import { UpdateCourseDto } from '../../modules/curriculum-content/course/dto/update-course.dto';
import { UpdateCurriculumRequirementDto } from '../../modules/curriculum-content/curriculum-requirement/dto/update-curriculum-requirement.dto';
import { UpdatePloDto } from '../../modules/curriculum-content/plo/dto/update-plo.dto';
import { UpdateCurriculumDto } from '../../modules/organization/curriculum/dto/update-curriculum.dto';
import { UpdateDepartmentDto } from '../../modules/organization/department/dto/update-department.dto';
import { UpdateProgramDto } from '../../modules/organization/program/dto/update-program.dto';

const SOME_UUID = 'b4f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d';

// Mirrors the global ValidationPipe options in main.ts.
async function validationErrors(dtoClass: new () => object, body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(dtoClass, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((error) => error.property);
}

const cases: Array<{
  dto: new () => object;
  parentKey: string;
  allowedBody: Record<string, unknown>;
}> = [
  { dto: UpdateDepartmentDto, parentKey: 'facultyId', allowedBody: { name: 'Renamed' } },
  { dto: UpdateProgramDto, parentKey: 'departmentId', allowedBody: { name: 'Renamed' } },
  { dto: UpdateCurriculumDto, parentKey: 'programId', allowedBody: { version: '2570' } },
  { dto: UpdateCourseDto, parentKey: 'curriculumId', allowedBody: { name: 'Renamed' } },
  { dto: UpdateCourseCategoryDto, parentKey: 'curriculumId', allowedBody: { name: 'Renamed' } },
  {
    dto: UpdateCurriculumRequirementDto,
    parentKey: 'curriculumId',
    allowedBody: { minCredits: 24 },
  },
  { dto: UpdateCloDto, parentKey: 'courseId', allowedBody: { description: 'Updated' } },
  { dto: UpdatePloDto, parentKey: 'curriculumId', allowedBody: { name: 'Renamed' } },
];

describe('Update DTOs keep the parent immutable', () => {
  it.each(cases)('$dto.name rejects $parentKey', async ({ dto, parentKey, allowedBody }) => {
    const errors = await validationErrors(dto, { ...allowedBody, [parentKey]: SOME_UUID });
    expect(errors).toEqual([parentKey]);
  });

  it.each(cases)('$dto.name accepts a body without a parent id', async ({ dto, allowedBody }) => {
    expect(await validationErrors(dto, allowedBody)).toEqual([]);
  });

  it('UpdateCourseDto still accepts categoryId', async () => {
    expect(await validationErrors(UpdateCourseDto, { categoryId: SOME_UUID })).toEqual([]);
  });

  it('UpdateCurriculumRequirementDto still accepts categoryId', async () => {
    expect(
      await validationErrors(UpdateCurriculumRequirementDto, { categoryId: SOME_UUID }),
    ).toEqual([]);
  });
});
