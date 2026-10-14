// Reads the `authTime` claim (unix seconds of the original login) from an
// access token and returns it in milliseconds. The payload is not secret and
// the signature is deliberately NOT checked: the value only drives a UI
// warning, the backend enforces the real cap on /auth/refresh.
export function decodeAuthTimeMs(token: string | null | undefined): number | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const claims = JSON.parse(json) as { authTime?: unknown };
    return typeof claims.authTime === 'number' && Number.isFinite(claims.authTime)
      ? claims.authTime * 1000
      : null;
  } catch {
    return null;
  }
}
