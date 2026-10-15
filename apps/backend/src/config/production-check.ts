// Boot-time sanity check for NODE_ENV=production. Names keys only — never
// echoes a value, so the messages are safe to log.
//
// Missing required keys throw. Weak-looking values only warn: the local
// docker-compose test runs the image with NODE_ENV=production against
// localhost URLs, so localhost/http must not be a hard failure.
const REQUIRED_IN_PRODUCTION = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_2FA_PENDING_SECRET',
  'TOTP_ENCRYPTION_KEY',
  'CORS_ORIGIN',
  'FRONTEND_URL',
] as const;

const SECRET_KEYS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'JWT_2FA_PENDING_SECRET'] as const;
const URL_KEYS = ['CORS_ORIGIN', 'FRONTEND_URL'] as const;
const MIN_SECRET_LENGTH = 32;

export function assertProductionConfig(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.NODE_ENV !== 'production') return [];

  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
  }

  const warnings: string[] = [];
  for (const key of SECRET_KEYS) {
    if ((env[key] ?? '').length < MIN_SECRET_LENGTH) {
      warnings.push(`${key} is shorter than ${MIN_SECRET_LENGTH} characters`);
    }
  }
  for (const key of URL_KEYS) {
    const value = env[key] ?? '';
    if (/localhost|127\.0\.0\.1/.test(value)) {
      warnings.push(`${key} points at localhost`);
    } else if (/(^|,)\s*http:\/\//.test(value)) {
      warnings.push(`${key} uses plain http (cookies are Secure in production)`);
    }
  }
  return warnings;
}
