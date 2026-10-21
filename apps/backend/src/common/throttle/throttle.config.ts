import { ThrottlerLimitDetail, ThrottlerModuleOptions } from '@nestjs/throttler';

// Thai 429 text with the wait time, for every throttled route. timeToExpire
// is in seconds; under a minute still reads as "about 1 minute".
export function throttleErrorMessage(_context: unknown, detail: ThrottlerLimitDetail): string {
  const minutes = Math.max(1, Math.ceil(detail.timeToExpire / 60));
  return `ลองบ่อยเกินไป กรุณารอประมาณ ${minutes} นาทีแล้วลองใหม่`;
}

// The app-wide default (100 requests/minute per IP). The object form (not a
// bare array) is what lets errorMessage apply: ThrottlerGuard ignores it when
// the options are an array.
export const THROTTLER_OPTIONS: ThrottlerModuleOptions = {
  throttlers: [{ ttl: 60_000, limit: 100 }],
  errorMessage: throttleErrorMessage,
};

// Routes that check the current password of a signed-in user (change
// password, turn 2FA off). These do not go through the login lockout, so
// without their own cap a stolen access token could try ~1,500 passwords in
// its 15 minutes. Per IP and per route, like every other limit here: the
// global guard runs before JwtAuthGuard, so the user is not known yet.
export const PASSWORD_CONFIRM_THROTTLE = { default: { limit: 5, ttl: 15 * 60_000 } };
