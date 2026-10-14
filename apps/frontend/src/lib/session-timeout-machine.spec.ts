import type { SessionMessage } from './session-channel';
import {
  createSessionTimeoutMachine,
  shouldAnnounceRemaining,
  type SessionTimeoutMachineDeps,
} from './session-timeout-machine';

const MIN = 60_000;
const HOUR = 60 * MIN;
const CONFIG = { idleMs: 30 * MIN, warningMs: 60_000, maxSessionMs: 8 * HOUR };

type Handler = (message: SessionMessage) => void;

// In-memory stand-in for the cross-tab channel: a message posted by one
// endpoint reaches every other endpoint, never itself.
function makeBus() {
  const endpoints: Array<{ handlers: Set<Handler> }> = [];
  return () => {
    const self = { handlers: new Set<Handler>() };
    endpoints.push(self);
    const posted: SessionMessage[] = [];
    return {
      posted,
      post: (message: SessionMessage) => {
        posted.push(message);
        endpoints.forEach((other) => {
          if (other !== self) other.handlers.forEach((handler) => handler(message));
        });
      },
      subscribe: (handler: Handler) => {
        self.handlers.add(handler);
        return () => {
          self.handlers.delete(handler);
        };
      },
    };
  };
}

function setup(overrides: Partial<SessionTimeoutMachineDeps> = {}, makeChannel = makeBus()) {
  const channel = makeChannel();
  const onEnd = jest.fn();
  const extend = jest.fn().mockResolvedValue(undefined);
  const machine = createSessionTimeoutMachine({
    config: CONFIG,
    channel,
    extend,
    getAuthTimeMs: () => Date.now(),
    onEnd,
    ...overrides,
  });
  return { machine, channel, onEnd, extend, makeChannel };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('idle → warn → extend', () => {
  it('warns 60 s before the idle deadline, and extending restarts the clock', async () => {
    const { machine, extend, channel, onEnd } = setup();
    machine.start();

    jest.advanceTimersByTime(30 * MIN - 61_000);
    expect(machine.getSnapshot().phase).toBe('active');

    jest.advanceTimersByTime(1000);
    expect(machine.getSnapshot()).toMatchObject({
      phase: 'warning',
      remainingSeconds: 60,
      canExtend: true,
    });

    await expect(machine.extend()).resolves.toBe(true);
    expect(extend).toHaveBeenCalledTimes(1);
    expect(machine.getSnapshot().phase).toBe('active');
    expect(channel.posted.at(-1)).toMatchObject({ type: 'extended' });

    // A full new idle window is available again.
    jest.advanceTimersByTime(30 * MIN - 61_000);
    expect(machine.getSnapshot().phase).toBe('active');
    jest.advanceTimersByTime(1000);
    expect(machine.getSnapshot().phase).toBe('warning');
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('counts the warning down second by second', () => {
    const { machine } = setup();
    machine.start();
    jest.advanceTimersByTime(30 * MIN - 60_000);
    expect(machine.getSnapshot().remainingSeconds).toBe(60);
    jest.advanceTimersByTime(10_000);
    expect(machine.getSnapshot().remainingSeconds).toBe(50);
  });
});

describe('idle → warn → expire', () => {
  it('ends once with reason idle when the warning runs out', () => {
    const { machine, onEnd, extend } = setup();
    machine.start();
    jest.advanceTimersByTime(30 * MIN);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith('idle', { remote: false });
    expect(machine.getSnapshot().phase).toBe('ended');

    jest.advanceTimersByTime(10 * MIN);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(extend).not.toHaveBeenCalled();
  });

  it('a failed extend ends the session as refresh-failed instead of pretending it worked', async () => {
    const { machine, onEnd, extend } = setup();
    extend.mockRejectedValue(new Error('401'));
    machine.start();
    jest.advanceTimersByTime(30 * MIN - 30_000);

    await expect(machine.extend()).resolves.toBe(false);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith('refresh-failed', { remote: false });
    expect(machine.getSnapshot().phase).toBe('ended');
  });

  it('ignores a double click on extend while the refresh is in flight', async () => {
    const { machine, extend } = setup();
    let resolve!: () => void;
    extend.mockReturnValue(new Promise<void>((r) => (resolve = r)));
    machine.start();
    jest.advanceTimersByTime(30 * MIN - 30_000);

    const first = machine.extend();
    expect(machine.getSnapshot().extending).toBe(true);
    await expect(machine.extend()).resolves.toBe(false);
    resolve();
    await expect(first).resolves.toBe(true);
    expect(extend).toHaveBeenCalledTimes(1);
  });
});

describe('activity', () => {
  it('resets the idle deadline while active', () => {
    const { machine, onEnd } = setup();
    machine.start();
    jest.advanceTimersByTime(20 * MIN);
    machine.activity();
    // New deadline is 50 min; the warning opens 60 s earlier, at 49 min.
    jest.advanceTimersByTime(28 * MIN);
    expect(machine.getSnapshot().phase).toBe('active');
    expect(onEnd).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1 * MIN);
    expect(machine.getSnapshot().phase).toBe('warning');
  });

  it('does not dismiss the warning — only "ต่อเวลา" does', () => {
    const { machine, onEnd } = setup();
    machine.start();
    jest.advanceTimersByTime(30 * MIN - 30_000);
    machine.activity();
    expect(machine.getSnapshot()).toMatchObject({
      phase: 'warning',
      remainingSeconds: 30,
    });
    jest.advanceTimersByTime(30_000);
    expect(onEnd).toHaveBeenCalledWith('idle', { remote: false });
  });

  it('tells other tabs about activity at most once per throttle window', () => {
    const { machine, channel } = setup();
    machine.start();
    jest.advanceTimersByTime(1000);
    machine.activity();
    jest.advanceTimersByTime(2000);
    machine.activity();
    jest.advanceTimersByTime(2000);
    machine.activity();
    expect(channel.posted.filter((m) => m.type === 'activity')).toHaveLength(1);
    jest.advanceTimersByTime(10_000);
    machine.activity();
    expect(channel.posted.filter((m) => m.type === 'activity')).toHaveLength(2);
  });
});

describe('absolute session cap', () => {
  it('ends at the cap even when the user is active the whole time', () => {
    const { machine, onEnd } = setup();
    machine.start();
    for (let i = 0; i < 23; i++) {
      jest.advanceTimersByTime(20 * MIN);
      machine.activity();
    }
    expect(onEnd).not.toHaveBeenCalled();

    // 7h40m so far: the cap, not idleness, produces the next warning.
    jest.advanceTimersByTime(19 * MIN);
    expect(machine.getSnapshot()).toMatchObject({
      phase: 'warning',
      canExtend: false,
    });

    jest.advanceTimersByTime(1 * MIN);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith('absolute', { remote: false });
  });

  it('refuses to extend a cap-driven warning (and never calls refresh)', async () => {
    const { machine, extend } = setup();
    machine.start();
    for (let i = 0; i < 23; i++) {
      jest.advanceTimersByTime(20 * MIN);
      machine.activity();
    }
    jest.advanceTimersByTime(19 * MIN);

    await expect(machine.extend()).resolves.toBe(false);
    expect(extend).not.toHaveBeenCalled();
    expect(machine.getSnapshot().phase).toBe('warning');
  });

  it('measures from the original login, not from this page load', () => {
    const loginAt = Date.now() - (8 * HOUR - 10 * MIN);
    const { machine, onEnd } = setup({ getAuthTimeMs: () => loginAt });
    machine.start();

    jest.advanceTimersByTime(9 * MIN);
    expect(machine.getSnapshot()).toMatchObject({
      phase: 'warning',
      canExtend: false,
    });
    jest.advanceTimersByTime(1 * MIN);
    expect(onEnd).toHaveBeenCalledWith('absolute', { remote: false });
  });

  it('an extension that would outlive the cap is still offered while idle comes first', async () => {
    const loginAt = Date.now() - (8 * HOUR - 45 * MIN);
    const { machine } = setup({ getAuthTimeMs: () => loginAt });
    machine.start();
    jest.advanceTimersByTime(30 * MIN - 30_000);
    expect(machine.getSnapshot()).toMatchObject({
      phase: 'warning',
      canExtend: true,
    });
    await machine.extend();
    expect(machine.getSnapshot().phase).toBe('active');
  });

  it('applies only the idle timeout when the login time is unknown', () => {
    const { machine, onEnd } = setup({ getAuthTimeMs: () => null });
    machine.start();
    for (let i = 0; i < 30; i++) {
      jest.advanceTimersByTime(20 * MIN);
      machine.activity();
    }
    expect(onEnd).not.toHaveBeenCalled();
  });
});

describe('clock jumps (sleeping laptop, throttled background tab)', () => {
  it('ends as idle when the clock jumps far past the deadline', () => {
    const { machine, onEnd } = setup();
    machine.start();
    jest.setSystemTime(Date.now() + 3 * HOUR);
    machine.evaluate();
    expect(onEnd).toHaveBeenCalledWith('idle', { remote: false });
  });

  it('lands in the warning when the jump stops inside the warning window', () => {
    const { machine, onEnd } = setup();
    machine.start();
    jest.setSystemTime(Date.now() + 30 * MIN - 30_000);
    machine.evaluate();
    expect(machine.getSnapshot()).toMatchObject({
      phase: 'warning',
      remainingSeconds: 30,
    });
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('activity right after waking cannot undo an already-expired idle window', () => {
    const { machine, onEnd } = setup();
    machine.start();
    jest.setSystemTime(Date.now() + 2 * HOUR);
    machine.activity();
    expect(onEnd).toHaveBeenCalledWith('idle', { remote: false });
  });
});

describe('across tabs', () => {
  it('extending in one tab closes the warning in the others', async () => {
    const makeChannel = makeBus();
    const a = setup({}, makeChannel);
    const b = setup({}, makeChannel);
    a.machine.start();
    b.machine.start();
    jest.advanceTimersByTime(30 * MIN - 30_000);
    expect(a.machine.getSnapshot().phase).toBe('warning');
    expect(b.machine.getSnapshot().phase).toBe('warning');

    await a.machine.extend();

    expect(b.machine.getSnapshot().phase).toBe('active');
    expect(b.extend).not.toHaveBeenCalled();
    expect(b.onEnd).not.toHaveBeenCalled();
  });

  it('activity in one tab keeps the other tab from idling out', () => {
    const makeChannel = makeBus();
    const a = setup({}, makeChannel);
    const b = setup({}, makeChannel);
    a.machine.start();
    b.machine.start();

    jest.advanceTimersByTime(20 * MIN);
    a.machine.activity();
    jest.advanceTimersByTime(28 * MIN);
    expect(b.machine.getSnapshot().phase).toBe('active');
    jest.advanceTimersByTime(1 * MIN);
    expect(b.machine.getSnapshot().phase).toBe('warning');
  });

  it('an ended message from another tab ends this one as remote (no second server logout)', () => {
    const makeChannel = makeBus();
    const a = setup({}, makeChannel);
    a.machine.start();
    const other = makeChannel();
    other.post({ type: 'ended', reason: 'logout', ts: Date.now() });

    expect(a.onEnd).toHaveBeenCalledTimes(1);
    expect(a.onEnd).toHaveBeenCalledWith('logout', { remote: true });
    // And it must not echo the end back out.
    expect(a.channel.posted).toHaveLength(0);
  });

  it('a tab ending on its own does not broadcast (the auth layer announces it once)', () => {
    const { machine, channel } = setup();
    machine.start();
    jest.advanceTimersByTime(30 * MIN);
    expect(channel.posted.filter((m) => m.type === 'ended')).toHaveLength(0);
  });

  it('ignores messages after stop()', () => {
    const makeChannel = makeBus();
    const a = setup({}, makeChannel);
    a.machine.start();
    a.machine.stop();
    makeChannel().post({ type: 'ended', reason: 'idle', ts: Date.now() });
    expect(a.onEnd).not.toHaveBeenCalled();
  });
});

describe('shouldAnnounceRemaining', () => {
  it('speaks every 10 s and the last 5 s, not every second', () => {
    const spoken = Array.from({ length: 60 }, (_, i) => 60 - i).filter((s) =>
      shouldAnnounceRemaining(s, false),
    );
    expect(spoken).toEqual([60, 50, 40, 30, 20, 10, 5, 4, 3, 2, 1]);
  });

  it('always speaks the first value, whatever it is, and never 0', () => {
    expect(shouldAnnounceRemaining(57, true)).toBe(true);
    expect(shouldAnnounceRemaining(0, true)).toBe(false);
  });
});
