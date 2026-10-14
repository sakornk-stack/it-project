import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Same 'jwt-refresh' strategy as JwtRefreshGuard, but never rejects:
// a missing, malformed, expired or revoked cookie resolves to
// `request.user = null` instead of a 401. Used by POST /auth/logout, which
// must clear the caller's cookie (and report success without revealing why
// a token was unusable) whatever state the cookie is in.
@Injectable()
export class OptionalJwtRefreshGuard extends AuthGuard('jwt-refresh') {
  handleRequest<TUser>(_err: unknown, user: TUser | false): TUser | null {
    return user || null;
  }
}
