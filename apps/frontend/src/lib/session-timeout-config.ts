const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

export const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;
export const DEFAULT_IDLE_WARNING_SECONDS = 60;
// Mirrors the backend's SESSION_ABSOLUTE_MAX_HOURS — the backend is the
// enforcer; this value only lets the UI warn before /auth/refresh starts
// refusing.
export const DEFAULT_SESSION_MAX_HOURS = 8;

export interface SessionTimeoutConfig {
  idleMs: number;
  warningMs: number;
  maxSessionMs: number;
}

function positiveNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(raw ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Anything that is not a positive finite number falls back to the default,
// and the warning window is kept strictly shorter than the idle timeout
// (otherwise the dialog would be showing from the moment of the last click).
export function parseSessionTimeoutConfig(env: {
  idleMinutes?: string;
  warningSeconds?: string;
  maxHours?: string;
}): SessionTimeoutConfig {
  const idleMs = positiveNumber(env.idleMinutes, DEFAULT_IDLE_TIMEOUT_MINUTES) * MINUTE_MS;
  let warningMs = positiveNumber(env.warningSeconds, DEFAULT_IDLE_WARNING_SECONDS) * 1000;
  if (warningMs >= idleMs) {
    warningMs = Math.min(DEFAULT_IDLE_WARNING_SECONDS * 1000, Math.floor(idleMs / 2));
  }
  const maxSessionMs = positiveNumber(env.maxHours, DEFAULT_SESSION_MAX_HOURS) * HOUR_MS;
  return { idleMs, warningMs, maxSessionMs };
}

// Next only inlines NEXT_PUBLIC_* when each one is read as a literal
// `process.env.NAME`, so they cannot be passed as a whole `process.env`.
export const SESSION_TIMEOUT_CONFIG: SessionTimeoutConfig = parseSessionTimeoutConfig({
  idleMinutes: process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES,
  warningSeconds: process.env.NEXT_PUBLIC_IDLE_WARNING_SECONDS,
  maxHours: process.env.NEXT_PUBLIC_SESSION_MAX_HOURS,
});
