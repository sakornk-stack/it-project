import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

// otplib ships ESM-only, which jest's CJS transform can't load; DI doesn't need it.
jest.mock('otplib', () => ({
  generateSecret: jest.fn(),
  generateURI: jest.fn(),
  verify: jest.fn(),
}));

// Four passport strategies read their credentials from process.env when they
// are constructed and throw without them (JwtStrategy, JwtRefreshStrategy,
// Jwt2faPendingStrategy: a secret; GoogleStrategy: a client id). CI has no
// .env, so set fake, non-secret values for this file only and restore after.
const FAKE_ENV = {
  JWT_ACCESS_SECRET: 'test-only-access-secret',
  JWT_REFRESH_SECRET: 'test-only-refresh-secret',
  JWT_2FA_PENDING_SECRET: 'test-only-2fa-pending-secret',
  GOOGLE_CLIENT_ID: 'test-only-google-client-id',
  GOOGLE_CLIENT_SECRET: 'test-only-google-client-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost/api/auth/google/callback',
};
const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const [key, value] of Object.entries(FAKE_ENV)) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }
});

afterAll(() => {
  for (const key of Object.keys(FAKE_ENV)) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

// Compiles the whole DI graph so a controller guard whose provider is not
// imported by its module (ScopeGuard, InstructorGuard, ...) fails here
// instead of at `nest start`. No DB is touched: PrismaService is stubbed
// and the app is never init()-ed (no onModuleInit/listen).
describe('AppModule DI graph', () => {
  it('resolves every provider and guard', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    expect(moduleRef.get(PrismaService)).toBeDefined();
    await moduleRef.close();
  });
});
