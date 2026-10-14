import { NEXT_PARAM, sanitizeNextPath } from './safe-next-path';

// Why a session ended. 'logout' is the user's own explicit sign-out; the
// others are involuntary and surface a message on the login page.
export type SessionEndReason = 'idle' | 'absolute' | 'refresh-failed' | 'logout';
export type InvoluntarySessionEndReason = Exclude<SessionEndReason, 'logout'>;

export const REASON_PARAM = 'reason';

export const SESSION_END_MESSAGE_TH: Record<InvoluntarySessionEndReason, string> = {
  idle: 'หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง',
  absolute: 'เซสชันมีอายุครบกำหนดสูงสุด กรุณาเข้าสู่ระบบอีกครั้ง',
  'refresh-failed': 'ไม่สามารถต่ออายุการใช้งานได้ กรุณาเข้าสู่ระบบอีกครั้ง',
};

// The ?reason= value comes from the URL, so it is whitelisted rather than
// trusted: anything unknown (and 'logout', which shows no message) is null.
export function parseSessionEndReason(
  raw: string | null | undefined,
): InvoluntarySessionEndReason | null {
  return raw === 'idle' || raw === 'absolute' || raw === 'refresh-failed' ? raw : null;
}

// Where to send someone whose session just ended. `next` keeps the page they
// were on (still run through sanitizeNextPath, so auth pages never loop).
export function buildLoginUrl({
  next,
  reason,
}: {
  next?: string | null;
  reason?: SessionEndReason | null;
}): string {
  const params = new URLSearchParams();
  const safeNext = sanitizeNextPath(next);
  if (safeNext) params.set(NEXT_PARAM, safeNext);
  if (reason && reason !== 'logout') params.set(REASON_PARAM, reason);
  const query = params.toString();
  return query ? `/login?${query}` : '/login';
}
