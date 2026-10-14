import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserService } from '../../users/user/user.service';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { JwtStrategy } from './jwt.strategy';

const PAYLOAD = { sub: 'u1', email: 'a@b.c', roles: ['SUPER_ADMIN', 'ADMIN'] as never };

function service(result: unknown) {
  const findAuthContext = jest.fn(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
  );
  const other = jest.fn();
  return {
    userService: { findAuthContext, findById: other } as unknown as UserService,
    findAuthContext,
    other,
  };
}

describe.each([
  ['JwtStrategy', (u: UserService) => new JwtStrategy(u)],
  [
    'JwtRefreshStrategy',
    // PAYLOAD carries no jti, so the revocation lookup is never reached here
    // (covered in auth.service.session.spec.ts).
    (u: UserService) => new JwtRefreshStrategy(u, {} as PrismaService),
  ],
])('%s', (_name, make) => {
  it('uses the roles stored in the database, not the ones in the token', async () => {
    const { userService } = service({ isActive: true, mustChangePassword: false, roles: ['STAFF'] });
    const user = await make(userService).validate(PAYLOAD);
    expect(user).toEqual({
      userId: 'u1',
      email: 'a@b.c',
      roles: ['STAFF'],
      mustChangePassword: false,
    });
  });

  it('a role revoked after the token was issued is gone on the next request', async () => {
    const first = service({ isActive: true, mustChangePassword: false, roles: ['ADMIN'] });
    const strategy = make(first.userService);
    expect((await strategy.validate(PAYLOAD)).roles).toEqual(['ADMIN']);
    first.findAuthContext.mockResolvedValueOnce({
      isActive: true,
      mustChangePassword: false,
      roles: [],
    } as never);
    expect((await strategy.validate(PAYLOAD)).roles).toEqual([]);
  });

  it('rejects a suspended account on its next request', async () => {
    const { userService } = service({ isActive: false, mustChangePassword: false, roles: ['ADMIN'] });
    await expect(make(userService).validate(PAYLOAD)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token whose account no longer exists as unauthorised, not 404', async () => {
    const { userService } = service(new NotFoundException());
    await expect(make(userService).validate(PAYLOAD)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('asks the database once per request, through the one auth-context call', async () => {
    const { userService, findAuthContext, other } = service({
      isActive: true,
      mustChangePassword: true,
      roles: ['STUDENT'],
    });
    await make(userService).validate(PAYLOAD);
    expect(findAuthContext).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });
});
