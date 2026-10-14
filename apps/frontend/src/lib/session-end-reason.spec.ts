import { buildLoginUrl, parseSessionEndReason, SESSION_END_MESSAGE_TH } from './session-end-reason';
import { decodeAuthTimeMs } from './session-token';

describe('parseSessionEndReason', () => {
  it.each(['idle', 'absolute', 'refresh-failed'])('accepts %s', (reason) => {
    expect(parseSessionEndReason(reason)).toBe(reason);
  });

  it.each([null, undefined, '', 'logout', 'IDLE', '<script>', 'idle&x=1'])(
    'rejects %p so a crafted URL cannot pick the message',
    (reason) => {
      expect(parseSessionEndReason(reason)).toBeNull();
    },
  );

  it('has the required Thai idle message', () => {
    expect(SESSION_END_MESSAGE_TH.idle).toBe('หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบอีกครั้ง');
  });
});

describe('buildLoginUrl', () => {
  it('is plain /login for an explicit logout', () => {
    expect(buildLoginUrl({ reason: 'logout' })).toBe('/login');
    expect(buildLoginUrl({})).toBe('/login');
  });

  it('carries the reason and the page the user was on', () => {
    expect(buildLoginUrl({ next: '/instructor/students?x=1', reason: 'idle' })).toBe(
      '/login?next=%2Finstructor%2Fstudents%3Fx%3D1&reason=idle',
    );
  });

  it('drops an unsafe next but keeps the reason', () => {
    expect(buildLoginUrl({ next: '//evil.com', reason: 'absolute' })).toBe(
      '/login?reason=absolute',
    );
    expect(buildLoginUrl({ next: '/login', reason: 'idle' })).toBe('/login?reason=idle');
  });
});

function tokenWith(payload: unknown): string {
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.signature`;
}

describe('decodeAuthTimeMs', () => {
  it('returns authTime in milliseconds', () => {
    expect(decodeAuthTimeMs(tokenWith({ sub: 'u', authTime: 1_700_000_000 }))).toBe(
      1_700_000_000_000,
    );
  });

  it.each([
    ['no token', null],
    ['empty', ''],
    ['not a jwt', 'abc'],
    ['bad base64', 'a.!!!.c'],
    ['no claim', tokenWith({ sub: 'u' })],
    ['non-numeric claim', tokenWith({ authTime: 'yesterday' })],
  ])('returns null for %s', (_name, token) => {
    expect(decodeAuthTimeMs(token as string | null)).toBeNull();
  });
});
