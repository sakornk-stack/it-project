import { PrismaService } from '../../../prisma/prisma.service';
import { ScopeResolverService } from '../../../common/scope/scope-resolver.service';
import { RequestUser } from '../../auth/request-user.interface';
import { UserService } from '../../users/user/user.service';
import { UserRoleService } from '../../users/user-role/user-role.service';
import { CourseService } from '../course/course.service';
import { CourseInstructorService } from './course-instructor.service';

function setup(programIds: string[]) {
  const findMany = jest.fn().mockResolvedValue([]);
  const getCoveredProgramIds = jest.fn().mockResolvedValue(programIds);
  const service = new CourseInstructorService(
    { courseInstructor: { findMany } } as unknown as PrismaService,
    {} as UserService,
    {} as UserRoleService,
    {} as CourseService,
    { getCoveredProgramIds } as unknown as ScopeResolverService,
  );
  return { service, findMany, getCoveredProgramIds };
}
const staff = { userId: 'staff-1', roles: ['STAFF'] } as unknown as RequestUser;

describe('CourseInstructorService.findAll — STAFF scope', () => {
  it('filters by the programs covered by the caller scopes', async () => {
    const { service, findMany, getCoveredProgramIds } = setup(['p1', 'p2']);
    await service.findAll(staff);
    expect(getCoveredProgramIds).toHaveBeenCalledWith('staff-1');
    expect(findMany).toHaveBeenCalledWith({
      where: { course: { curriculum: { programId: { in: ['p1', 'p2'] } } } },
    });
  });

  it('combines courseId with the scope filter', async () => {
    const { service, findMany } = setup(['p1']);
    await service.findAll(staff, 'c1');
    expect(findMany.mock.calls[0][0].where).toEqual({
      courseId: 'c1',
      course: { curriculum: { programId: { in: ['p1'] } } },
    });
  });

  it('matches nothing when the caller scope covers no programs', async () => {
    const { service, findMany } = setup([]);
    await service.findAll(staff);
    expect(findMany.mock.calls[0][0].where.course.curriculum.programId).toEqual({ in: [] });
  });
});
