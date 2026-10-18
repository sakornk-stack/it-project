// Self-service sign-up (email+password and Google) is limited to these email
// domains. Invitations from staff are not: the invitation link itself proves
// the mailbox, and staff chose the address.
export const DEFAULT_SIGNUP_DOMAINS = ['ku.th'];

// "ku.th, Test.Local " -> ['ku.th', 'test.local']. Unset or blank -> the
// default, so a missing env var never opens sign-up to every domain.
export function parseSignupDomains(raw: string | undefined): string[] {
  const domains = (raw ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d !== '');
  return domains.length > 0 ? domains : DEFAULT_SIGNUP_DOMAINS;
}

// One form for every comparison and every row written by a sign-up path, so
// "A@ku.th" and "a@ku.th" can never become two accounts.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string): string | null {
  const parts = normalizeEmail(email).split('@');
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') return null;
  return parts[1];
}

// Whole-domain equality only: never endsWith/includes, so "evilku.th",
// "sub.ku.th" and "ku.th.evil.com" are all refused.
export function isAllowedSignupEmail(email: string, allowedDomains: readonly string[]): boolean {
  const domain = emailDomain(email);
  return domain !== null && allowedDomains.includes(domain);
}
