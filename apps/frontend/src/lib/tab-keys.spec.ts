import { nextTabIndex } from './tab-keys';

describe('nextTabIndex', () => {
  it('steps right and wraps to the first tab', () => {
    expect(nextTabIndex(0, 'ArrowRight', 3)).toBe(1);
    expect(nextTabIndex(2, 'ArrowRight', 3)).toBe(0);
  });

  it('steps left and wraps to the last tab', () => {
    expect(nextTabIndex(1, 'ArrowLeft', 3)).toBe(0);
    expect(nextTabIndex(0, 'ArrowLeft', 3)).toBe(2);
  });

  it('jumps to the ends with Home and End', () => {
    expect(nextTabIndex(1, 'Home', 3)).toBe(0);
    expect(nextTabIndex(1, 'End', 3)).toBe(2);
  });

  it('ignores other keys and an empty list', () => {
    expect(nextTabIndex(1, 'Enter', 3)).toBeNull();
    expect(nextTabIndex(0, 'ArrowRight', 0)).toBeNull();
  });
});
