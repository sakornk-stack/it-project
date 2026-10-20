import type { SessionEndReason } from './session-end-reason';

// Cross-tab messages. Every tab shares one idle clock through these:
// activity / extended move the deadline, ended tears the session down.
export type SessionMessage =
  | { type: 'activity'; ts: number }
  | { type: 'extended'; ts: number }
  | { type: 'ended'; reason: SessionEndReason; ts: number };

export interface SessionChannel {
  post: (message: SessionMessage) => void;
  // Returns an unsubscribe function. Messages sent by this same channel
  // instance are never delivered back to it.
  subscribe: (handler: (message: SessionMessage) => void) => () => void;
  close: () => void;
}

const CHANNEL_NAME = 'eduanalyze-session';
const STORAGE_KEY = 'eduanalyze.session-event';

interface Envelope {
  senderId: string;
  nonce: number;
  message: SessionMessage;
}

interface BroadcastChannelLike {
  postMessage: (data: unknown) => void;
  onmessage: ((event: { data: unknown }) => void) | null;
  close: () => void;
}

export interface SessionChannelDeps {
  // null forces the localStorage fallback (used by tests and old browsers).
  createBroadcastChannel?: ((name: string) => BroadcastChannelLike) | null;
  storage?: Pick<Storage, 'setItem' | 'removeItem'> | null;
  // Subscribes to the window 'storage' event; fires only for OTHER tabs.
  onStorageEvent?:
    ((handler: (key: string | null, value: string | null) => void) => () => void) | null;
  senderId?: string;
}

function isEnvelope(value: unknown): value is Envelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<Envelope>;
  return typeof v.senderId === 'string' && typeof v.message === 'object' && v.message !== null;
}

// Per-tab id used only to ignore our own broadcasts; getRandomValues (unlike randomUUID)
// also works outside secure contexts.
function randomSenderId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function defaultDeps(): Required<SessionChannelDeps> {
  const g = globalThis as {
    BroadcastChannel?: new (name: string) => BroadcastChannelLike;
    localStorage?: Storage;
    addEventListener?: (type: string, listener: (event: StorageEvent) => void) => void;
    removeEventListener?: (type: string, listener: (event: StorageEvent) => void) => void;
  };
  let storage: Storage | null = null;
  try {
    storage = g.localStorage ?? null;
  } catch {
    storage = null;
  }
  const Ctor = g.BroadcastChannel;
  return {
    createBroadcastChannel: Ctor ? (name) => new Ctor(name) : null,
    storage,
    onStorageEvent: (handler) => {
      const listener = (event: StorageEvent) => handler(event.key, event.newValue);
      g.addEventListener?.('storage', listener);
      return () => g.removeEventListener?.('storage', listener);
    },
    senderId: randomSenderId(),
  };
}

// BroadcastChannel when available, otherwise a localStorage write whose
// 'storage' event the other tabs receive. Every browser-API touch is wrapped
// in try/catch: private mode, blocked storage or quota errors must degrade to
// "this tab just doesn't sync", never break the page.
export function createSessionChannel(overrides: SessionChannelDeps = {}): SessionChannel {
  const deps = { ...defaultDeps(), ...overrides };
  const handlers = new Set<(message: SessionMessage) => void>();
  let nonce = 0;

  const deliver = (data: unknown) => {
    if (!isEnvelope(data) || data.senderId === deps.senderId) return;
    handlers.forEach((handler) => handler(data.message));
  };

  let broadcast: BroadcastChannelLike | null = null;
  let stopStorageListener: (() => void) | null = null;

  try {
    broadcast = deps.createBroadcastChannel?.(CHANNEL_NAME) ?? null;
    if (broadcast) broadcast.onmessage = (event) => deliver(event.data);
  } catch {
    broadcast = null;
  }

  if (!broadcast) {
    try {
      stopStorageListener =
        deps.onStorageEvent?.((key, value) => {
          if (key !== STORAGE_KEY || !value) return;
          try {
            deliver(JSON.parse(value));
          } catch {
            // Malformed value written by something else — ignore.
          }
        }) ?? null;
    } catch {
      stopStorageListener = null;
    }
  }

  return {
    post(message) {
      const envelope: Envelope = {
        senderId: deps.senderId,
        nonce: nonce++,
        message,
      };
      try {
        if (broadcast) {
          broadcast.postMessage(envelope);
        } else if (deps.storage) {
          // The nonce makes every write a *change*, which is what fires 'storage'.
          deps.storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
          deps.storage.removeItem(STORAGE_KEY);
        }
      } catch {
        // See the note above — a failed sync must never surface.
      }
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    close() {
      handlers.clear();
      stopStorageListener?.();
      try {
        broadcast?.close();
      } catch {
        // Already closed.
      }
    },
  };
}

let shared: SessionChannel | null = null;

// One channel per tab, shared by the idle-timeout machine and by AuthProvider
// (which announces explicit sign-outs).
export function getSessionChannel(): SessionChannel {
  shared ??= createSessionChannel();
  return shared;
}
