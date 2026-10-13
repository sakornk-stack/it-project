import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

// otplib ships ESM-only, which jest's CJS transform can't load; DI doesn't need it.
jest.mock('otplib', () => ({
  generateSecret: jest.fn(),
  generateURI: jest.fn(),
  verify: jest.fn(),
}));

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
