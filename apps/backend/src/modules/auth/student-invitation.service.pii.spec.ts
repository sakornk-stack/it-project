import { PrismaService } from '../../prisma/prisma.service';
import { ScopeResolverService } from '../../common/scope/scope-resolver.service';
import { UserService } from '../users/user/user.service';
import { StudentProfileService } from '../users/student-profile/student-profile.service';
import { RequestUser } from './request-user.interface';
import { StudentInvitationService } from './student-invitation.service';

const PII = ['email', 'fullName', 'studentCode'];

function setup() {
  const findMany = jest.fn().mockResolvedValue([]);
  const getCoveredProgramIds = jest.fn().mockResolvedValue(['p1']);
  const service = new StudentInvitationService(
    { studentInvitation: { findMany } } as unknown as PrismaService,
    {} as StudentProfileService,
    {} as UserService,
    { getCoveredProgramIds } as unknown as ScopeResolverService,
  );
  return { service, findMany };
}
const asUser = (roles: string[]) => ({ userId: 'u1', roles }) as unknown as RequestUser;

describe('StudentInvitationService.findAllInScope — PII', () => {
  it('SUPER_ADMIN selection excludes email, fullName and studentCode but keeps the rest', async () => {
    const { service, findMany } = setup();
    await service.findAllInScope(asUser(['SUPER_ADMIN']));
    const select = findMany.mock.calls[0][0].select;
    for (const field of PII) expect(select).not.toHaveProperty(field);
    expect(select).toMatchObject({ id: true, programId: true, expiresAt: true });
    expect(select).not.toHaveProperty('tokenHash');
  });

  it('STAFF still gets PII, scoped by program', async () => {
    const { service, findMany } = setup();
    await service.findAllInScope(asUser(['STAFF']));
    const arg = findMany.mock.calls[0][0];
    for (const field of PII) expect(arg.select).toHaveProperty(field, true);
    expect(arg.where).toEqual({ programId: { in: ['p1'] } });
  });
});
