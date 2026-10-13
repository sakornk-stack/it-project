// One place for the page-entrance timing, so every page and every role moves the same way.
export const REVEAL_STAGGER_MS = 60;
// Past this index the delay stops growing: a long page never makes its last block wait.
export const REVEAL_MAX_STAGGER_INDEX = 6;
// A block that comes into view within this long of mounting belongs to the first screen and is
// staggered by index; one that appears later (scrolled to) plays at once.
export const REVEAL_INITIAL_BATCH_MS = 200;

export function revealDelayMs(index: number, inInitialBatch: boolean): number {
  if (!inInitialBatch) return 0;
  const safe = Number.isFinite(index) ? Math.floor(index) : 0;
  return Math.min(Math.max(safe, 0), REVEAL_MAX_STAGGER_INDEX) * REVEAL_STAGGER_MS;
}
