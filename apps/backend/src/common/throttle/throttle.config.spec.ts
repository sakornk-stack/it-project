import { Controller, INestApplication, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  PASSWORD_CONFIRM_THROTTLE,
  THROTTLER_OPTIONS,
  throttleErrorMessage,
} from './throttle.config';
import { AuthController } from '../../modules/auth/auth.controller';

// otplib ships ESM-only, which jest's CJS transform can't load; reached through
// AuthController's imports, never called here.
jest.mock('otplib', () => ({ generateSecret: jest.fn(), generateURI: jest.fn(), verify: jest.fn() }));

// A stand-in for the two password-confirming routes, under the same decorator
// and the app's real throttler options, so the test exercises the actual
// ThrottlerGuard (no DB, no auth). Listens on an ephemeral 127.0.0.1 port.
@Controller('probe')
class ProbeController {
  @Post('password-confirm')
  @Throttle(PASSWORD_CONFIRM_THROTTLE)
  confirm() {
    return { ok: true };
  }

  @Post('ordinary')
  ordinary() {
    return { ok: true };
  }
}

describe('throttle config', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(THROTTLER_OPTIONS)],
      controllers: [ProbeController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (path: string) => fetch(`${base}/probe/${path}`, { method: 'POST' });

  it('allows 5 password confirmations per 15 minutes, then answers 429 in Thai', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await post('password-confirm')).status).toBe(201);
    }
    const blocked = await post('password-confirm');
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as { message: string };
    // The window is 15 minutes, so the wait shown is close to that.
    expect(body.message).toMatch(/^ลองบ่อยเกินไป กรุณารอประมาณ 1[45] นาทีแล้วลองใหม่$/);
  });

  it('leaves other routes on the ordinary 100/minute limit', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await post('ordinary')).status).toBe(201);
    }
  });

  it('change-password and 2fa/disable carry the 5-per-15-minutes limit', () => {
    for (const handler of ['changePassword', 'twoFactorDisable'] as const) {
      const target = AuthController.prototype[handler];
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', target)).toBe(5);
      expect(Reflect.getMetadata('THROTTLER:TTLdefault', target)).toBe(15 * 60_000);
    }
  });

  it('the message rounds the wait up to whole minutes, never below 1', () => {
    const detail = (timeToExpire: number) => ({ timeToExpire }) as never;
    expect(throttleErrorMessage(null, detail(900))).toBe('ลองบ่อยเกินไป กรุณารอประมาณ 15 นาทีแล้วลองใหม่');
    expect(throttleErrorMessage(null, detail(61))).toBe('ลองบ่อยเกินไป กรุณารอประมาณ 2 นาทีแล้วลองใหม่');
    expect(throttleErrorMessage(null, detail(5))).toBe('ลองบ่อยเกินไป กรุณารอประมาณ 1 นาทีแล้วลองใหม่');
  });
});
