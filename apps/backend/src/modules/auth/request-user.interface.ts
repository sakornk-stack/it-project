import { Role } from '@prisma/client';

// Shape attached to `request.user` by JwtStrategy.validate() — consumed
// by RolesGuard and the @CurrentUser() decorator.
export interface RequestUser {
  userId: string;
  email: string;
  roles: Role[];
  mustChangePassword: boolean;
  // Only set by JwtRefreshStrategy — see JwtPayload.authTime.
  authTime?: number;
  // Only set by JwtRefreshStrategy: the presented refresh token's `jti`
  // and `exp` (unix seconds), so logout can denylist exactly that token.
  refreshJti?: string;
  refreshExp?: number;
}
