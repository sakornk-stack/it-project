import { parseSignupDomains } from '../common/auth/signup-domain';

const DEFAULT_SESSION_ABSOLUTE_MAX_HOURS = 8;

// Falls back to the default for anything that isn't a positive finite
// number (unset, empty, "abc", 0, negative) — a typo must not silently
// disable or zero the cap.
export function parseSessionAbsoluteMaxHours(raw: string | undefined): number {
  const parsed = Number.parseFloat(raw ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SESSION_ABSOLUTE_MAX_HOURS;
}

// Number of reverse-proxy hops in front of the API (nginx, a CDN, ...), so
// Express reads the real client IP from X-Forwarded-For. Anything that is not
// a non-negative whole number means "trust no proxy" (0): trusting too many
// hops lets a client spoof its IP and dodge the per-IP rate limit.
export function parseTrustProxyHops(raw: string | undefined): number {
  const trimmed = (raw ?? '').trim();
  if (!/^\d+$/.test(trimmed)) return 0;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number.parseInt(process.env.PORT || '3001', 10),
  trustProxyHops: parseTrustProxyHops(process.env.TRUST_PROXY_HOPS),
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    // Signs the short-lived "pending 2FA" token between password-verify
    // and TOTP-code-verify — separate secret so it can never be replayed
    // as a real access/refresh token. Jwt2faPendingStrategy reads
    // JWT_2FA_PENDING_SECRET directly from process.env (same reason as
    // JwtStrategy/JwtRefreshStrategy: can't use ConfigService before
    // super() runs) — kept here too for consistency/future non-strategy use.
    twoFactorPendingSecret: process.env.JWT_2FA_PENDING_SECRET,
    twoFactorPendingExpiresIn: process.env.JWT_2FA_PENDING_EXPIRES_IN || '5m',
  },
  session: {
    // Hard cap on a session measured from the original login; /auth/refresh
    // refuses to mint new access tokens past it. The frontend mirrors the
    // value (NEXT_PUBLIC_SESSION_MAX_HOURS) only to warn the user early.
    absoluteMaxHours: parseSessionAbsoluteMaxHours(process.env.SESSION_ABSOLUTE_MAX_HOURS),
  },
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? [],
  },
  // Used only to build the post-OAuth redirect target in
  // AuthController.googleAuthCallback — the browser lands there directly
  // after Google, so it must be a real frontend URL, not the API's own.
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  google: {
    // GoogleStrategy reads these directly from process.env (can't use
    // ConfigService before super() runs) — kept here too for consistency
    // with the rest of this file and for any future non-strategy use.
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
    // true: a NEW Google sign-up must also carry the Workspace `hd` claim for
    // an allowed domain (the account is managed by that organisation), not
    // just a verified address. Returning users are not affected.
    requireHostedDomain: process.env.GOOGLE_REQUIRE_HOSTED_DOMAIN === 'true',
  },
  signup: {
    // Domains self-service sign-up accepts (default ku.th). Dev/test add
    // test.local in their own .env — never in code.
    allowedDomains: parseSignupDomains(process.env.SELF_SIGNUP_ALLOWED_DOMAINS),
  },
  totp: {
    encryptionKey: process.env.TOTP_ENCRYPTION_KEY,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number.parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  },
  ai: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    // Interpreting already-computed numbers into hedged prose (§25-26) is
    // not open-ended reasoning — the cheapest/fastest current model is the
    // right default; override via env if that changes.
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
  },
});
