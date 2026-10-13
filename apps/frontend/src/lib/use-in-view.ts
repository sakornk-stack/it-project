import { useEffect, useRef, useState } from 'react';

// One-shot "has this element been reached by scrolling?" flag. The root's top
// margin is made huge so everything ABOVE the viewport counts as intersecting
// too: an IntersectionObserver only calls back when visibility changes, so a
// block skipped entirely by a fast scroll or a restored scroll position would
// otherwise never fire and stay hidden for good. The bottom margin is a fixed
// 24px (not a percentage) so a short block at the very end of a page, sitting
// above main's 16-32px bottom padding, can still be reached at max scroll.
// Without IntersectionObserver there is nothing to wait for, so everything is
// simply visible.
//
// All elements share ONE observer (a page can hold dozens of progress bars);
// each is dropped from it the moment it has been seen.
const listeners = new WeakMap<Element, () => void>();
let sharedObserver: IntersectionObserver | null = null;

function getObserver(): IntersectionObserver {
  if (!sharedObserver) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const notify = listeners.get(entry.target);
          if (!notify) continue;
          listeners.delete(entry.target);
          observer.unobserve(entry.target);
          notify();
        }
      },
      { threshold: 0, rootMargin: '100000px 0px -24px 0px' },
    );
    sharedObserver = observer;
  }
  return sharedObserver;
}

export function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<{ seen: boolean; msToSeen: number }>({
    seen: false,
    msToSeen: 0,
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setState({ seen: true, msToSeen: 0 });
      return;
    }

    const startedAt = performance.now();
    listeners.set(node, () => setState({ seen: true, msToSeen: performance.now() - startedAt }));
    getObserver().observe(node);
    return () => {
      listeners.delete(node);
      sharedObserver?.unobserve(node);
    };
  }, []);

  // msToSeen: how long after mounting the element was first reached (0 when
  // there is no IntersectionObserver). Callers use it to tell first-screen
  // blocks from ones scrolled to later.
  return { ref, seen: state.seen, msToSeen: state.msToSeen };
}
