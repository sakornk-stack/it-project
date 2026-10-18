import { Logger } from '@nestjs/common';
import { EmailSignupRequestService } from './email-signup-request.service';
import {
  CLEANUP_GRACE_MS,
  CLEANUP_INTERVAL_MS,
  ExpiredSignupCleanupService,
} from './expired-signup-cleanup.service';
import { GooglePendingRegistrationService } from './google-pending-registration.service';

function setup() {
  const email = { deleteExpiredBefore: jest.fn().mockResolvedValue(2) };
  const google = { deleteExpiredBefore: jest.fn().mockResolvedValue(1) };
  const service = new ExpiredSignupCleanupService(
    email as unknown as EmailSignupRequestService,
    google as unknown as GooglePendingRegistrationService,
  );
  return { service, email, google };
}

describe('ExpiredSignupCleanupService', () => {
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('deletes only rows expired more than 24 hours ago, from both tables', async () => {
    const { service, email, google } = setup();
    const now = new Date('2026-10-18T12:00:00Z');
    await service.runOnce(now);
    const cutoff = new Date('2026-10-17T12:00:00Z');
    expect(CLEANUP_GRACE_MS).toBe(24 * 60 * 60 * 1000);
    expect(email.deleteExpiredBefore).toHaveBeenCalledWith(cutoff);
    expect(google.deleteExpiredBefore).toHaveBeenCalledWith(cutoff);
  });

  it('logs counts only — no email, token or hash', async () => {
    const { service } = setup();
    await service.runOnce();
    expect(log).toHaveBeenCalledTimes(1);
    const message = String(log.mock.calls[0][0]);
    expect(message).toContain('email_signup_requests=2');
    expect(message).toContain('google_pending_registrations=1');
    expect(message).not.toMatch(/@|token|hash/i);
  });

  it('stays quiet when nothing was removed', async () => {
    const { service, email, google } = setup();
    email.deleteExpiredBefore.mockResolvedValue(0);
    google.deleteExpiredBefore.mockResolvedValue(0);
    await service.runOnce();
    expect(log).not.toHaveBeenCalled();
  });

  it('never throws; a failure logs only the error name', async () => {
    const { service, email } = setup();
    email.deleteExpiredBefore.mockRejectedValue(new Error('connect failed for u@test.local'));
    await expect(service.runOnce()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('Expired sign-up cleanup failed: Error');
  });

  it('does not overlap runs', async () => {
    const { service, email } = setup();
    let release!: (n: number) => void;
    email.deleteExpiredBefore.mockReturnValueOnce(new Promise((r) => (release = r)));
    const first = service.runOnce();
    await service.runOnce();
    release(0);
    await first;
    expect(email.deleteExpiredBefore).toHaveBeenCalledTimes(1);
  });

  it('runs at bootstrap, then hourly, and stops on module destroy', async () => {
    jest.useFakeTimers();
    const { service, email } = setup();
    service.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
    expect(email.deleteExpiredBefore).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(CLEANUP_INTERVAL_MS);
    expect(email.deleteExpiredBefore).toHaveBeenCalledTimes(2);
    expect(CLEANUP_INTERVAL_MS).toBe(60 * 60 * 1000);

    service.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(CLEANUP_INTERVAL_MS * 3);
    expect(email.deleteExpiredBefore).toHaveBeenCalledTimes(2);
  });
});
