import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../users/user/user.service';
import { JwtPayload } from '../jwt-payload.interface';
import { RequestUser } from '../request-user.interface';
import { issuedBeforeTokenValidAfter } from './token-valid-after';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Read directly from process.env — ConfigService can't be used here
      // since it isn't available until after super() runs (same reason
      // main.ts reads process.env.PORT directly rather than via
      // ConfigService).
      secretOrKey: process.env.JWT_ACCESS_SECRET,
    });
  }

  // Queries the DB on every request rather than trusting the token's
  // claims statelessly — per CONVENTIONS.md §8's "always resolve live"
  // principle, so a deactivated account is rejected on its very next
  // request, and a revoked or granted role applies on the next request,
  // instead of staying as it was until the access token expires (up to 15
  // minutes later). The token is only proof of who the caller is.
  async validate(payload: JwtPayload & { iat?: number }): Promise<RequestUser> {
    let user;
    try {
      user = await this.userService.findAuthContext(payload.sub);
    } catch (error) {
      // A token for a user that no longer exists is an auth failure, not
      // a 404 — don't leak UserService's NotFoundException as-is.
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('Account no longer exists');
      }
      throw error;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }
    // Password changed/reset after this token was issued: the client's 401
    // handler falls back to /auth/refresh, which only a post-change refresh
    // cookie can pass.
    if (issuedBeforeTokenValidAfter(payload.iat, user.tokenValidAfter)) {
      throw new UnauthorizedException('Session has ended');
    }
    return {
      userId: payload.sub,
      email: payload.email,
      roles: user.roles,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
