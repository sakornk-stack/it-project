'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSessionChannel } from './session-channel';
import type { SessionEndReason } from './session-end-reason';
import { SESSION_TIMEOUT_CONFIG, type SessionTimeoutConfig } from './session-timeout-config';
import {
  createSessionTimeoutMachine,
  IDLE_SESSION_SNAPSHOT,
  type SessionSnapshot,
  type SessionTimeoutMachine,
} from './session-timeout-machine';

// What counts as "the user is here". All passive and captured on the
// document, so one set of listeners covers the whole app (scroll does not
// bubble, hence capture).
const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
  'click',
] as const;
// mousemove can fire hundreds of times a second; the machine only needs to
// hear about activity about once a second.
const ACTIVITY_THROTTLE_MS = 1000;

interface UseIdleTimeoutOptions {
  enabled: boolean;
  extend: () => Promise<void>;
  getAuthTimeMs: () => number | null;
  onEnd: (reason: SessionEndReason, info: { remote: boolean }) => void;
  config?: SessionTimeoutConfig;
}

// Thin React binding for the idle-timeout state machine: owns the DOM
// listeners and the machine's lifecycle; all timing logic lives in
// session-timeout-machine.ts (unit-tested there).
export function useIdleTimeout({
  enabled,
  extend,
  getAuthTimeMs,
  onEnd,
  config = SESSION_TIMEOUT_CONFIG,
}: Readonly<UseIdleTimeoutOptions>) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(IDLE_SESSION_SNAPSHOT);
  const machineRef = useRef<SessionTimeoutMachine | null>(null);

  // Latest callbacks, so changing them never tears the machine down (which
  // would reset the idle clock).
  const callbacks = useRef({ extend, getAuthTimeMs, onEnd });
  callbacks.current = { extend, getAuthTimeMs, onEnd };

  useEffect(() => {
    if (!enabled) {
      setSnapshot(IDLE_SESSION_SNAPSHOT);
      return;
    }

    const machine = createSessionTimeoutMachine({
      config,
      channel: getSessionChannel(),
      extend: () => callbacks.current.extend(),
      getAuthTimeMs: () => callbacks.current.getAuthTimeMs(),
      onEnd: (reason, info) => callbacks.current.onEnd(reason, info),
    });
    machineRef.current = machine;
    const unsubscribe = machine.subscribe(setSnapshot);

    let lastForwarded = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastForwarded < ACTIVITY_THROTTLE_MS) return;
      lastForwarded = now;
      machine.activity();
    };
    // Timers are frozen or throttled in background tabs and while the machine
    // sleeps, so re-derive the phase from the clock the moment the user is back.
    const onWake = () => {
      machine.evaluate();
      onActivity();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onWake();
    };

    const options = { passive: true, capture: true } as const;
    ACTIVITY_EVENTS.forEach((name) => document.addEventListener(name, onActivity, options));
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onVisibility);
    machine.start();

    return () => {
      ACTIVITY_EVENTS.forEach((name) => document.removeEventListener(name, onActivity, options));
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onVisibility);
      machine.stop();
      unsubscribe();
      machineRef.current = null;
    };
  }, [enabled, config]);

  const extendNow = useCallback(() => machineRef.current?.extend() ?? Promise.resolve(false), []);

  return { snapshot, extend: extendNow };
}
