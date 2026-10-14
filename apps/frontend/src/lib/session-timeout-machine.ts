import type { SessionChannel, SessionMessage } from './session-channel';
import type { SessionEndReason } from './session-end-reason';
import type { SessionTimeoutConfig } from './session-timeout-config';

export type SessionPhase = 'active' | 'warning' | 'ended';

export interface SessionSnapshot {
  phase: SessionPhase;
  // Whole seconds left, only meaningful in 'warning' (0 otherwise, so a
  // quiet 'active' phase never re-renders subscribers once a second).
  remainingSeconds: number;
  // False when the countdown is the absolute session cap: refreshing cannot
  // push that out, so the UI must not offer "ต่อเวลา".
  canExtend: boolean;
  extending: boolean;
}

export interface SessionTimeoutMachineDeps {
  config: SessionTimeoutConfig;
  channel: Pick<SessionChannel, 'post' | 'subscribe'>;
  // Renews the session for real (POST /auth/refresh). Rejects when it cannot.
  extend: () => Promise<void>;
  // Original login time in ms (from the access token's authTime claim), or
  // null when unknown — then only the idle timeout applies client-side.
  getAuthTimeMs: () => number | null;
  // Called exactly once. `remote` is true when another tab ended the
  // session, in which case the server logout has already been done there.
  onEnd: (reason: SessionEndReason, info: { remote: boolean }) => void;
  now?: () => number;
  tickMs?: number;
  // Own-tab activity is announced to other tabs at most this often.
  activityBroadcastMs?: number;
}

export interface SessionTimeoutMachine {
  start: () => void;
  stop: () => void;
  // User activity in this tab. Ignored while the warning is up: the user
  // must press "ต่อเวลา" explicitly.
  activity: () => void;
  // Re-derive the phase from the clock now — call on tab focus/visibility
  // change, because timers are throttled or frozen in background tabs.
  evaluate: () => void;
  extend: () => Promise<boolean>;
  getSnapshot: () => SessionSnapshot;
  subscribe: (listener: (snapshot: SessionSnapshot) => void) => () => void;
}

const INITIAL: SessionSnapshot = {
  phase: 'active',
  remainingSeconds: 0,
  canExtend: true,
  extending: false,
};

export const IDLE_SESSION_SNAPSHOT = INITIAL;

// Screen readers hear the countdown at the first moment, then every 10 s and
// each of the last 5 s — never every second.
export function shouldAnnounceRemaining(seconds: number, isFirst: boolean): boolean {
  if (seconds <= 0) return false;
  return isFirst || seconds % 10 === 0 || seconds <= 5;
}

export function createSessionTimeoutMachine(
  deps: SessionTimeoutMachineDeps,
): SessionTimeoutMachine {
  const { config, channel, onEnd } = deps;
  const now = deps.now ?? (() => Date.now());
  const tickMs = deps.tickMs ?? 1000;
  const activityBroadcastMs = deps.activityBroadcastMs ?? 10_000;

  let snapshot = INITIAL;
  let lastActivity = 0;
  let lastBroadcast = 0;
  let authTimeMs: number | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;
  let running = false;
  let extending = false;
  const listeners = new Set<(snapshot: SessionSnapshot) => void>();

  const publish = (next: SessionSnapshot) => {
    if (
      next.phase === snapshot.phase &&
      next.remainingSeconds === snapshot.remainingSeconds &&
      next.canExtend === snapshot.canExtend &&
      next.extending === snapshot.extending
    ) {
      return;
    }
    snapshot = next;
    listeners.forEach((listener) => listener(snapshot));
  };

  // A function (not an inline comparison) so TypeScript does not narrow
  // `snapshot` across an await — it can change to 'ended' while a refresh
  // is in flight.
  const isEnded = () => snapshot.phase === 'ended';

  const end = (reason: SessionEndReason, remote: boolean) => {
    if (isEnded()) return;
    if (timer) clearInterval(timer);
    timer = null;
    publish({
      phase: 'ended',
      remainingSeconds: 0,
      canExtend: false,
      extending: false,
    });
    onEnd(reason, { remote });
  };

  const evaluate = () => {
    if (!running || snapshot.phase === 'ended') return;
    const t = now();
    const idleDeadline = lastActivity + config.idleMs;
    const absoluteDeadline =
      authTimeMs === null ? Number.POSITIVE_INFINITY : authTimeMs + config.maxSessionMs;

    if (t >= absoluteDeadline) return end('absolute', false);
    if (t >= idleDeadline) return end('idle', false);

    const deadline = Math.min(idleDeadline, absoluteDeadline);
    if (t >= deadline - config.warningMs) {
      publish({
        phase: 'warning',
        remainingSeconds: Math.ceil((deadline - t) / 1000),
        // Extending moves the idle deadline only; it helps unless the cap
        // comes first.
        canExtend: absoluteDeadline >= idleDeadline,
        extending,
      });
    } else {
      publish({
        phase: 'active',
        remainingSeconds: 0,
        canExtend: true,
        extending,
      });
    }
  };

  const handleRemote = (message: SessionMessage) => {
    if (!running || snapshot.phase === 'ended') return;
    if (message.type === 'ended') {
      end(message.reason, true);
      return;
    }
    // activity and extended both mean "someone is here": adopt the later
    // timestamp so every tab converges on one idle clock.
    lastActivity = Math.max(lastActivity, message.ts);
    if (message.type === 'extended') {
      authTimeMs = deps.getAuthTimeMs() ?? authTimeMs;
    }
    evaluate();
  };

  return {
    start() {
      if (running) return;
      running = true;
      lastActivity = now();
      lastBroadcast = 0;
      authTimeMs = deps.getAuthTimeMs();
      unsubscribe = channel.subscribe(handleRemote);
      timer = setInterval(evaluate, tickMs);
      evaluate();
    },

    stop() {
      running = false;
      if (timer) clearInterval(timer);
      timer = null;
      unsubscribe?.();
      unsubscribe = null;
    },

    activity() {
      if (!running) return;
      evaluate();
      if (snapshot.phase !== 'active') return;
      const t = now();
      lastActivity = t;
      if (t - lastBroadcast >= activityBroadcastMs) {
        lastBroadcast = t;
        channel.post({ type: 'activity', ts: t });
      }
    },

    evaluate,

    async extend() {
      if (!running || snapshot.phase !== 'warning' || !snapshot.canExtend || extending) {
        return false;
      }
      extending = true;
      publish({ ...snapshot, extending: true });
      try {
        await deps.extend();
      } catch {
        extending = false;
        // Not a success: the session is gone (refresh cookie expired, account
        // deactivated, cap reached). Say so instead of carrying on.
        end('refresh-failed', false);
        return false;
      }
      extending = false;
      // Ended elsewhere (another tab) while the refresh was in flight.
      if (!running || isEnded()) return false;
      const t = now();
      lastActivity = t;
      lastBroadcast = t;
      authTimeMs = deps.getAuthTimeMs() ?? authTimeMs;
      channel.post({ type: 'extended', ts: t });
      publish({
        phase: 'active',
        remainingSeconds: 0,
        canExtend: true,
        extending: false,
      });
      evaluate();
      return true;
    },

    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
