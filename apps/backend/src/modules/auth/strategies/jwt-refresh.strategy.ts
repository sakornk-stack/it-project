import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserService } from '../../users/user/user.service';
import { JwtPayload } from '../jwt-payload.interface';
import { RequestUser } from '../request-user.interface';

// Sibling to JwtStrategy — same "always resolve live" re-fetch, but reads
// the refresh token from the httpOnly cookie (never a header, never
// touched by frontend JS) and verifies against JWT_REFRESH_SECRET instead
// of the access secret. Named explicitly so it doesn't collide with
// JwtStrategy's implicit 'jwt' registration.
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: (req: Request) => req?.cookies?.refreshToken ?? null,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_REFRESH_SECRET,
    });
  }

  async validate(
    payload: JwtPayload & { iat?: number; exp?: number; jti?: string },
  ): Promise<RequestUser> {
    // Tokens issued before `jti` existed can't be individually revoked;
    // they age out via `exp`.
    if (payload.jti) {
      const revoked = await this.prisma.revokedRefreshToken.findUnique({
        where: { jti: payload.jti },
      });
      if (revoked) {
        throw new UnauthorizedException('Session has ended');
      }
    }

    let user;
    try {
      user = await this.userService.findAuthContext(payload.sub);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('Account no longer exists');
      }
      throw error;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }
    return {
      userId: payload.sub,
      email: payload.email,
      roles: user.roles,
      mustChangePassword: user.mustChangePassword,
      authTime: payload.authTime ?? payload.iat,
      refreshJti: payload.jti,
      refreshExp: payload.exp,
    };
  }
}
