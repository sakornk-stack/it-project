import {
  createSessionChannel,
  type SessionChannelDeps,
  type SessionMessage,
} from './session-channel';

const msg: SessionMessage = { type: 'extended', ts: 1 };

// Emulates BroadcastChannel: same-name instances hear each other, never self.
function makeBroadcastEnv() {
  type Fake = {
    onmessage: ((e: { data: unknown }) => void) | null;
    self: object;
  };
  const instances: Fake[] = [];
  const create = () => {
    const self: Fake = { onmessage: null, self: {} };
    instances.push(self);
    return {
      postMessage: (data: unknown) =>
        instances.forEach((i) => i !== self && i.onmessage?.({ data })),
      get onmessage() {
        return self.onmessage;
      },
      set onmessage(fn) {
        self.onmessage = fn;
      },
      close: jest.fn(),
    };
  };
  return { create };
}

// Emulates localStorage + the cross-tab 'storage' event (fires only in OTHER tabs).
function makeStorageEnv() {
  const tabs: Array<(key: string | null, value: string | null) => void> = [];
  const failing = { set: false };
  const tab = (): SessionChannelDeps => {
    const myHandlers: Array<(key: string | null, value: string | null) => void> = [];
    return {
      createBroadcastChannel: null,
      storage: {
        setItem: (key: string, value: string) => {
          if (failing.set) throw new Error('QuotaExceeded');
          tabs.forEach((handler) => {
            if (!myHandlers.includes(handler)) handler(key, value);
          });
        },
        removeItem: () => undefined,
      },
      onStorageEvent: (handler) => {
        myHandlers.push(handler);
        tabs.push(handler);
        return () => undefined;
      },
    };
  };
  return {
    tab,
    failing,
    deliverRaw: (value: string) => tabs.forEach((h) => h('eduanalyze.session-event', value)),
  };
}

describe('createSessionChannel via BroadcastChannel', () => {
  it('delivers to other tabs but not back to the sender', () => {
    const env = makeBroadcastEnv();
    const a = createSessionChannel({
      createBroadcastChannel: env.create,
      senderId: 'a',
      storage: null,
    });
    const b = createSessionChannel({
      createBroadcastChannel: env.create,
      senderId: 'b',
      storage: null,
    });
    const fromA = jest.fn();
    const fromB = jest.fn();
    a.subscribe(fromA);
    b.subscribe(fromB);

    a.post(msg);

    expect(fromB).toHaveBeenCalledWith(msg);
    expect(fromA).not.toHaveBeenCalled();
  });

  it('unsubscribe stops delivery', () => {
    const env = makeBroadcastEnv();
    const a = createSessionChannel({
      createBroadcastChannel: env.create,
      senderId: 'a',
      storage: null,
    });
    const b = createSessionChannel({
      createBroadcastChannel: env.create,
      senderId: 'b',
      storage: null,
    });
    const handler = jest.fn();
    const off = b.subscribe(handler);
    off();
    a.post(msg);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('createSessionChannel localStorage fallback', () => {
  it('syncs tabs when BroadcastChannel is unavailable', () => {
    const env = makeStorageEnv();
    const a = createSessionChannel({ ...env.tab(), senderId: 'a' });
    const b = createSessionChannel({ ...env.tab(), senderId: 'b' });
    const handler = jest.fn();
    b.subscribe(handler);

    a.post({ type: 'ended', reason: 'idle', ts: 5 });

    expect(handler).toHaveBeenCalledWith({
      type: 'ended',
      reason: 'idle',
      ts: 5,
    });
  });

  it('never throws when the storage write fails', () => {
    const env = makeStorageEnv();
    const a = createSessionChannel({ ...env.tab(), senderId: 'a' });
    env.failing.set = true;
    expect(() => a.post(msg)).not.toThrow();
  });

  it('never throws when storage is entirely unavailable', () => {
    const a = createSessionChannel({
      createBroadcastChannel: null,
      storage: null,
      onStorageEvent: null,
      senderId: 'a',
    });
    expect(() => a.post(msg)).not.toThrow();
    expect(() => a.close()).not.toThrow();
  });

  it('falls back to storage when constructing a BroadcastChannel throws', () => {
    const env = makeStorageEnv();
    const a = createSessionChannel({
      ...env.tab(),
      createBroadcastChannel: () => {
        throw new Error('SecurityError');
      },
      senderId: 'a',
    });
    const b = createSessionChannel({ ...env.tab(), senderId: 'b' });
    const handler = jest.fn();
    b.subscribe(handler);
    a.post(msg);
    expect(handler).toHaveBeenCalledWith(msg);
  });

  it('ignores malformed or foreign storage values', () => {
    const env = makeStorageEnv();
    const b = createSessionChannel({ ...env.tab(), senderId: 'b' });
    const handler = jest.fn();
    b.subscribe(handler);
    env.deliverRaw('not json');
    env.deliverRaw(JSON.stringify({ hello: 'world' }));
    env.deliverRaw(JSON.stringify(null));
    expect(handler).not.toHaveBeenCalled();
  });
});
