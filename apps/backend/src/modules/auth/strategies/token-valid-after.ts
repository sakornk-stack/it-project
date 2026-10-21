// A password change/reset stamps User.tokenValidAfter (floored to the second);
// any access or refresh token issued before it is dead. `iat` is in seconds,
// so a token issued in that same second still passes — which is what lets the
// fresh refresh token handed out by changePassword itself keep working.
export function issuedBeforeTokenValidAfter(
  iat: number | undefined,
  tokenValidAfter: Date | null,
): boolean {
  return !!tokenValidAfter && (iat ?? 0) < Math.floor(tokenValidAfter.getTime() / 1000);
}
