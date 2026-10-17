import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RequestUser } from '../../modules/auth/request-user.interface';
import { CatalogScopeService } from './catalog-scope.service';

function setup(programIds: string[] = []) {
  const getCoveredProgramIds = jest.fn().mockResolvedValue(programIds);
  const service = new CatalogScopeService({ getCoveredProgramIds } as never);
  return { service, getCoveredProgramIds };
}
const userWith = (...roles: Role[]) => ({ userId: 'u1', roles }) as unknown as RequestUser;

describe('CatalogScopeService.curriculumWhere', () => {
  it.each(['STAFF', 'ADMIN'] as Role[])('%s: curricula of the covered programs', async (role) => {
    const { service, getCoveredProgramIds } = setup(['p1', 'p2']);
    await expect(service.curriculumWhere(userWith(role))).resolves.toEqual({
      programId: { in: ['p1', 'p2'] },
    });
    expect(getCoveredProgramIds).toHaveBeenCalledWith('u1');
  });

  it('STAFF/ADMIN with no covered program matches nothing', async () => {
    const { service } = setup([]);
    await expect(service.curriculumWhere(userWith('ADMIN'))).resolves.toEqual({
      programId: { in: [] },
    });
  });

  it('INSTRUCTOR: curricula of the courses they teach, scope never consulted', async () => {
    const { service, getCoveredProgramIds } = setup(['p1']);
    await expect(service.curriculumWhere(userWith('INSTRUCTOR'))).resolves.toEqual({
      courses: { some: { instructors: { some: { userId: 'u1' } } } },
    });
    expect(getCoveredProgramIds).not.toHaveBeenCalled();
  });

  it('STUDENT: own curriculum or one of a course on their own transcript', async () => {
    const { service } = setup();
    await expect(service.curriculumWhere(userWith('STUDENT'))).resolves.toEqual({
      OR: [
        { studentProfiles: { some: { userId: 'u1' } } },
        {
          courses: {
            some: { studentRecords: { some: { studentProfile: { userId: 'u1' } } } },
          },
        },
      ],
    });
  });

  it('a user with several roles gets the union of their clauses', async () => {
    const { service } = setup(['p1']);
    const where = await service.curriculumWhere(userWith('ADMIN', 'INSTRUCTOR'));
    expect(where).toEqual({
      OR: [
        { programId: { in: ['p1'] } },
        { courses: { some: { instructors: { some: { userId: 'u1' } } } } },
      ],
    });
  });

  it('SUPER_ADMIN has no access to academic data', async () => {
    const { service, getCoveredProgramIds } = setup(['p1']);
    await expect(service.curriculumWhere(userWith('SUPER_ADMIN'))).rejects.toThrow(
      ForbiddenException,
    );
    expect(getCoveredProgramIds).not.toHaveBeenCalled();
  });

  it('no role at all is refused too', async () => {
    const { service } = setup();
    await expect(service.curriculumWhere(userWith())).rejects.toThrow(ForbiddenException);
  });
});
