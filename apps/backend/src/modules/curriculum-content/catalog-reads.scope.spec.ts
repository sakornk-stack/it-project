import { NotFoundException } from '@nestjs/common';
import { CloPloMappingService } from './clo-plo-mapping/clo-plo-mapping.service';
import { CloService } from './clo/clo.service';
import { CourseCategoryService } from './course-category/course-category.service';
import { CourseService } from './course/course.service';
import { CurriculumRequirementService } from './curriculum-requirement/curriculum-requirement.service';
import { PloService } from './plo/plo.service';
import { PrerequisiteService } from './prerequisite/prerequisite.service';

// The curriculum filter comes from CatalogScopeService (its own spec); here we pin
// where each service puts it, so an out-of-scope row can't come back from the DB.
const IN_SCOPE = { programId: { in: ['p1'] } };
const NOTHING = { programId: { in: [] } };

type Delegate = { findMany: jest.Mock; findFirst: jest.Mock };
const delegate = (): Delegate => ({
  findMany: jest.fn().mockResolvedValue([{ id: 'row' }]),
  findFirst: jest.fn().mockResolvedValue({ id: 'row' }),
});

// [name, model on the prisma mock, build the service, expected where for IN_SCOPE]
const CASES: [string, string, (prisma: never) => unknown, (c: object) => object][] = [
  [
    'CourseService',
    'course',
    (p) => new CourseService(p, {} as never, {} as never, {} as never),
    (c) => ({ isActive: true, curriculum: c }),
  ],
  [
    'PrerequisiteService',
    'prerequisite',
    (p) => new PrerequisiteService(p, {} as never, {} as never),
    (c) => ({ course: { curriculum: c } }),
  ],
  [
    'CourseCategoryService',
    'courseCategory',
    (p) => new CourseCategoryService(p, {} as never, {} as never),
    (c) => ({ isActive: true, curriculum: c }),
  ],
  [
    'CurriculumRequirementService',
    'curriculumRequirement',
    (p) => new CurriculumRequirementService(p, {} as never, {} as never, {} as never),
    (c) => ({ curriculum: c }),
  ],
  [
    'CloService',
    'clo',
    (p) => new CloService(p, {} as never),
    (c) => ({ isActive: true, course: { curriculum: c } }),
  ],
  [
    'PloService',
    'plo',
    (p) => new PloService(p, {} as never),
    (c) => ({ isActive: true, curriculum: c }),
  ],
  [
    'CloPloMappingService',
    'cloPloMapping',
    (p) => new CloPloMappingService(p, {} as never, {} as never, {} as never),
    (c) => ({ isActive: true, plo: { curriculum: c } }),
  ],
];

describe.each(CASES)('%s — scoped reads', (_name, model, build, expectedWhere) => {
  function setup() {
    const d = delegate();
    const service = build({ [model]: d } as never) as {
      findAllInCurricula: (c: object) => Promise<unknown>;
      findOneInCurricula: (id: string, c: object) => Promise<unknown>;
    };
    return { service, d };
  }

  it('findAllInCurricula puts the caller curriculum filter in the query', async () => {
    const { service, d } = setup();
    await service.findAllInCurricula(IN_SCOPE);
    expect(d.findMany).toHaveBeenCalledWith({ where: expectedWhere(IN_SCOPE) });
  });

  it('findAllInCurricula for a caller covering nothing filters on an empty set', async () => {
    const { service, d } = setup();
    await service.findAllInCurricula(NOTHING);
    expect(d.findMany).toHaveBeenCalledWith({ where: expectedWhere(NOTHING) });
  });

  it('findOneInCurricula looks the row up inside the caller scope', async () => {
    const { service, d } = setup();
    await expect(service.findOneInCurricula('x1', IN_SCOPE)).resolves.toEqual({ id: 'row' });
    expect(d.findFirst).toHaveBeenCalledWith({
      where: { id: 'x1', ...expectedWhere(IN_SCOPE) },
    });
  });

  it('findOneInCurricula answers 404 for a row outside the scope', async () => {
    const { service, d } = setup();
    d.findFirst.mockResolvedValue(null);
    await expect(service.findOneInCurricula('x1', NOTHING)).rejects.toThrow(NotFoundException);
  });
});
