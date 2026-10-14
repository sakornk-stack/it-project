import { Role } from '@prisma/client';

// Shared shape signed into both access and refresh tokens. Deliberately
// excludes UserScope — CONVENTIONS.md §8 requires scope to be resolved
// live (with an isActive check on the target entity) on every request,
// so embedding a scope snapshot here would go stale the moment a scope's
// target Faculty/Department/Program is soft-deleted.
export interface JwtPayload {
  sub: string;
  email: string;
  roles: Role[];
  // Unix seconds of the original credential login. Carried unchanged
  // across /auth/refresh so the absolute session lifetime
  // (SESSION_ABSOLUTE_MAX_HOURS) is measured from login, not from the
  // latest refresh. Optional: tokens issued before this claim existed
  // fall back to `iat` of the refresh token.
  authTime?: number;
}
