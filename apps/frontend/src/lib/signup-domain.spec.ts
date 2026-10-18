import { googleLoginErrorMessage } from './google-login-error';
import { registerSchema } from './validation/register.schema';
import {
  isAllowedSignupEmail,
  parseSignupDomains,
  signupDomainError,
  takeTokenFromUrl,
} from './signup-domain';

describe('parseSignupDomains', () => {
  it('defaults to ku.th and normalises a list', () => {
    expect(parseSignupDomains(undefined)).toEqual(['ku.th']);
    expect(parseSignupDomains(' KU.TH, test.local ')).toEqual(['ku.th', 'test.local']);
  });
});

describe('isAllowedSignupEmail', () => {
  it.each(['a@ku.th', 'A@KU.TH', ' a@ku.th '])('accepts %p', (email) => {
    expect(isAllowedSignupEmail(email, ['ku.th'])).toBe(true);
  });

  it.each(['a@evilku.th', 'a@sub.ku.th', 'a@ku.th.evil.com', 'a@ku.th@x.com', 'ku.th', ''])(
    'refuses %p',
    (email) => {
      expect(isAllowedSignupEmail(email, ['ku.th'])).toBe(false);
    },
  );

  it('names every allowed domain in the error', () => {
    expect(signupDomainError(['ku.th', 'test.local'])).toBe(
      'สมัครด้วยตนเองได้เฉพาะอีเมล @ku.th หรือ @test.local',
    );
  });
});

describe('takeTokenFromUrl', () => {
  function fakeWindow(href: string) {
    const replaceState = jest.fn();
    return { win: { location: { href }, history: { replaceState } } as never, replaceState };
  }

  it('returns the token and strips it from the address bar, keeping the rest', () => {
    const { win, replaceState } = fakeWindow('http://fe.test/register/verify?token=abc&x=1#h');
    expect(takeTokenFromUrl(win)).toBe('abc');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/register/verify?x=1#h');
  });

  it('reads and strips a differently named parameter, leaving the others', () => {
    const { win, replaceState } = fakeWindow(
      'http://fe.test/register/google?pendingToken=xyz&requires2fa=1',
    );
    expect(takeTokenFromUrl(win, 'pendingToken')).toBe('xyz');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/register/google?requires2fa=1');
  });

  it('returns null for a missing or blank token', () => {
    expect(takeTokenFromUrl(fakeWindow('http://fe.test/register/verify').win)).toBeNull();
    expect(takeTokenFromUrl(fakeWindow('http://fe.test/register/verify?token=').win)).toBeNull();
  });
});

describe('googleLoginErrorMessage', () => {
  it('maps the known codes to Thai and ignores anything else', () => {
    expect(googleLoginErrorMessage('email_exists')).toContain('รหัสผ่าน');
    expect(googleLoginErrorMessage('email_unverified')).toContain('ยืนยันอีเมล');
    expect(googleLoginErrorMessage('domain_not_allowed')).toContain('@ku.th');
    expect(googleLoginErrorMessage('<script>')).toBeNull();
    expect(googleLoginErrorMessage(null)).toBeNull();
  });
});

describe('registerSchema email domain', () => {
  const UUID = 'a3f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d';
  const values = (email: string) => ({
    email,
    password: 'P@ssw0rd123',
    confirmPassword: 'P@ssw0rd123',
    fullName: 'New Student',
    studentCode: '6512345678',
    facultyId: UUID,
    departmentId: UUID,
    programId: UUID,
    curriculumId: UUID,
    admissionYear: 2568,
    acceptPrivacyPolicy: true,
  });

  it('accepts @ku.th and refuses evilku.th with the Thai domain message', () => {
    expect(registerSchema.safeParse(values('new@ku.th')).success).toBe(true);
    const bad = registerSchema.safeParse(values('new@evilku.th'));
    expect(bad.success).toBe(false);
    expect(bad.success ? '' : bad.error.issues[0].message).toContain('@ku.th');
  });
});
