import {
  emailDomain,
  isAllowedSignupEmail,
  normalizeEmail,
  parseSignupDomains,
} from './signup-domain';

describe('parseSignupDomains', () => {
  it('defaults to ku.th when unset or blank', () => {
    expect(parseSignupDomains(undefined)).toEqual(['ku.th']);
    expect(parseSignupDomains('  ,  ')).toEqual(['ku.th']);
  });

  it('splits, trims and lower-cases a list', () => {
    expect(parseSignupDomains(' ku.th, Test.Local ')).toEqual(['ku.th', 'test.local']);
  });
});

describe('normalizeEmail / emailDomain', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Somchai.J@KU.TH ')).toBe('somchai.j@ku.th');
  });

  it('returns null for anything without exactly one @ and both parts', () => {
    expect(emailDomain('ku.th')).toBeNull();
    expect(emailDomain('@ku.th')).toBeNull();
    expect(emailDomain('a@')).toBeNull();
    expect(emailDomain('a@ku.th@evil.com')).toBeNull();
  });
});

describe('isAllowedSignupEmail', () => {
  const allowed = ['ku.th'];

  it.each(['a@ku.th', 'A@KU.TH', ' a@ku.th '])('accepts %p', (email) => {
    expect(isAllowedSignupEmail(email, allowed)).toBe(true);
  });

  it.each([
    'a@evilku.th',
    'a@sub.ku.th',
    'a@ku.th.evil.com',
    'a@ku.th@evil.com',
    'a@ku.ac.th',
    'ku.th',
    '',
  ])('refuses %p', (email) => {
    expect(isAllowedSignupEmail(email, allowed)).toBe(false);
  });

  it('accepts a second domain only when it is configured', () => {
    expect(isAllowedSignupEmail('new@test.local', allowed)).toBe(false);
    expect(isAllowedSignupEmail('new@test.local', ['ku.th', 'test.local'])).toBe(true);
  });
});
