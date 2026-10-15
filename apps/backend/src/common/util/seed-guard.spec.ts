import { assertSeedAllowed } from './seed-guard';

describe('assertSeedAllowed', () => {
  it('refuses in production without the flag', () => {
    expect(() => assertSeedAllowed('seed.ts', { NODE_ENV: 'production' })).toThrow(
      /Refusing to run seed\.ts/,
    );
  });

  it('allows production only with ALLOW_PROD_SEED=yes', () => {
    expect(() =>
      assertSeedAllowed('seed.ts', { NODE_ENV: 'production', ALLOW_PROD_SEED: 'yes' }),
    ).not.toThrow();
  });

  it.each(['true', '1', 'YES', 'Yes', ' yes', ''])(
    'still refuses in production for ALLOW_PROD_SEED=%p',
    (flag) => {
      expect(() =>
        assertSeedAllowed('import.ts', { NODE_ENV: 'production', ALLOW_PROD_SEED: flag }),
      ).toThrow();
    },
  );

  it.each([undefined, 'development', 'test'])('allows NODE_ENV=%p', (nodeEnv) => {
    expect(() => assertSeedAllowed('seed.ts', { NODE_ENV: nodeEnv })).not.toThrow();
  });

  it('does not echo env values in the message', () => {
    try {
      assertSeedAllowed('seed.ts', {
        NODE_ENV: 'production',
        ALLOW_PROD_SEED: 'secret-looking-value',
      });
    } catch (error) {
      expect((error as Error).message).not.toContain('secret-looking-value');
    }
  });
});
