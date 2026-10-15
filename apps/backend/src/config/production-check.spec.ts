import { assertProductionConfig } from './production-check';

const GOOD_SECRET = 'x'.repeat(40);
const complete = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://placeholder',
  JWT_ACCESS_SECRET: GOOD_SECRET,
  JWT_REFRESH_SECRET: GOOD_SECRET,
  JWT_2FA_PENDING_SECRET: GOOD_SECRET,
  TOTP_ENCRYPTION_KEY: GOOD_SECRET,
  CORS_ORIGIN: 'https://app.example.com',
  FRONTEND_URL: 'https://app.example.com',
});

describe('assertProductionConfig', () => {
  it('does nothing outside production', () => {
    expect(assertProductionConfig({ NODE_ENV: 'development' })).toEqual([]);
    expect(assertProductionConfig({})).toEqual([]);
  });

  it('passes a complete production config with no warnings', () => {
    expect(assertProductionConfig(complete())).toEqual([]);
  });

  it('throws naming every missing key, without values', () => {
    const env = complete();
    delete env.JWT_REFRESH_SECRET;
    env.CORS_ORIGIN = '  ';
    expect(() => assertProductionConfig(env)).toThrow(/JWT_REFRESH_SECRET, CORS_ORIGIN/);
    try {
      assertProductionConfig(env);
    } catch (error) {
      expect((error as Error).message).not.toContain(GOOD_SECRET);
    }
  });

  it('warns on short secrets', () => {
    const env = { ...complete(), JWT_ACCESS_SECRET: 'short' };
    expect(assertProductionConfig(env)).toEqual([
      'JWT_ACCESS_SECRET is shorter than 32 characters',
    ]);
  });

  it('warns (does not throw) for localhost and plain http URLs', () => {
    const env = {
      ...complete(),
      CORS_ORIGIN: 'http://localhost:3000',
      FRONTEND_URL: 'http://app.example.com',
    };
    const warnings = assertProductionConfig(env);
    expect(warnings).toContain('CORS_ORIGIN points at localhost');
    expect(warnings.some((w) => w.startsWith('FRONTEND_URL uses plain http'))).toBe(true);
  });
});
