// Frontend mirror of the backend's sign-up domain rule, for the hint under the
// email field and an early form error only — the server decides
// (SELF_SIGNUP_ALLOWED_DOMAINS). Keep NEXT_PUBLIC_SELF_SIGNUP_DOMAINS equal to it.
export function parseSignupDomains(raw: string | undefined): string[] {
  const domains = (raw ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d !== '');
  return domains.length > 0 ? domains : ['ku.th'];
}

export const SIGNUP_DOMAINS = parseSignupDomains(process.env.NEXT_PUBLIC_SELF_SIGNUP_DOMAINS);

// Whole-domain equality, like the backend: "evilku.th" and "sub.ku.th" fail.
export function isAllowedSignupEmail(email: string, domains: readonly string[] = SIGNUP_DOMAINS) {
  const parts = email.trim().toLowerCase().split('@');
  return parts.length === 2 && parts[0] !== '' && domains.includes(parts[1]);
}

export function signupDomainsText(domains: readonly string[] = SIGNUP_DOMAINS): string {
  return domains.map((d) => `@${d}`).join(' หรือ ');
}

export function signupDomainError(domains: readonly string[] = SIGNUP_DOMAINS): string {
  return `สมัครด้วยตนเองได้เฉพาะอีเมล ${signupDomainsText(domains)}`;
}

// Same sentence the backend uses for 202 on register and resend.
export const SIGNUP_RESEND_COOLDOWN_SECONDS = 60;

// Reads a one-time token from the URL (/register/verify?token=…, or
// ?pendingToken=… after Google) and removes it from the address bar at once, so
// it is not left in history, screenshots or a Referer header. Returns null for
// a missing or blank token. Other query parameters are kept.
export function takeTokenFromUrl(
  win: Pick<Window, 'location' | 'history'>,
  param = 'token',
): string | null {
  const url = new URL(win.location.href);
  const token = url.searchParams.get(param)?.trim() || null;
  if (url.searchParams.has(param)) {
    url.searchParams.delete(param);
    win.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }
  return token;
}
