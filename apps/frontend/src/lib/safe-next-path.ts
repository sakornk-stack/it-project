export const NEXT_PARAM = 'next';
export const GOOGLE_NEXT_STORAGE_KEY = 'eduanalyze.postLoginNext';

// Only same-origin paths are honoured as a post-login destination: anything
// else ("//evil.com", "/\evil.com", "https://…", "javascript:…") would turn
// the login page into an open redirect. Auth pages are refused too, so a
// stale ?next=/login cannot bounce the user in a loop.
export function sanitizeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return null;
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(next)) return null;
  const path = next.split(/[?#]/)[0];
  if (isPublicPath(path)) return null;
  return next;
}

// Pages that are reachable without a session: the landing hub and the auth
// forms. Not valid post-login destinations, and the idle-timeout guard stays
// off on them (there is no session to time out).
export function isPublicPath(path: string): boolean {
  return (
    path === '/' ||
    path === '/login' ||
    path.startsWith('/register') ||
    path === '/forgot-password' ||
    path === '/reset-password'
  );
}
