import { ploProgressBarColorClassName, ploStatusTone } from './plo-color';
import { ploBarAriaLabel, ploBarStatus, ploTickPercent } from './plo-bar';

describe('ploBarStatus', () => {
  it('has no data without a value, and no verdict without a pass mark', () => {
    expect(ploBarStatus(null, 70)).toBe('no-data');
    expect(ploBarStatus(null, null)).toBe('no-data');
    expect(ploBarStatus(50, null)).toBe('unjudged');
  });

  it('passes at exactly the pass mark and above, is "below" anywhere under it', () => {
    expect(ploBarStatus(70, 70)).toBe('passed');
    expect(ploBarStatus(100, 70)).toBe('passed');
    expect(ploBarStatus(69.9, 70)).toBe('below');
    expect(ploBarStatus(0, 70)).toBe('below');
  });

  it('handles the ends of the scale (0 and 5.0 = 100%) against a 70% mark', () => {
    expect(ploBarStatus(0, 70)).toBe('below');
    expect(ploBarStatus(100, 70)).toBe('passed');
  });

  it('agrees with the bar colour and the badge tone at every boundary', () => {
    const byColour = { 'bg-emerald-600': 'passed', 'bg-amber-500': 'below' } as const;
    for (const v of [0, 30, 69.9, 70, 70.1, 100]) {
      expect(byColour[ploProgressBarColorClassName(v, 70) as keyof typeof byColour]).toBe(
        ploBarStatus(v, 70),
      );
      expect(ploStatusTone(v, 70)).toBe(ploBarStatus(v, 70) === 'passed' ? 'success' : 'warning');
    }
  });
});

describe('ploTickPercent', () => {
  it("is the curriculum's own pass mark, not a fixed one", () => {
    expect(ploTickPercent(70)).toBe(70);
    expect(ploTickPercent(60)).toBe(60);
    expect(ploTickPercent(62.5)).toBe(62.5);
  });

  it('has no tick without a pass mark', () => {
    expect(ploTickPercent(null)).toBeNull();
    expect(ploTickPercent(Number.NaN)).toBeNull();
  });

  it('keeps the tick on the bar at the ends and for out-of-range values', () => {
    expect(ploTickPercent(0)).toBe(0);
    expect(ploTickPercent(100)).toBe(100);
    expect(ploTickPercent(-5)).toBe(0);
    expect(ploTickPercent(140)).toBe(100);
  });
});

describe('ploBarAriaLabel', () => {
  it('says the verdict and the pass mark in words', () => {
    expect(ploBarAriaLabel('PLO1', 'ความรู้', 80, 70)).toBe(
      'PLO1 ความรู้ — ผ่านเกณฑ์ เกณฑ์ผ่าน ≥ 3.5 / 5.0',
    );
    expect(ploBarAriaLabel('PLO2', 'ทักษะ', 40, 70)).toBe(
      'PLO2 ทักษะ — ยังไม่ผ่านเกณฑ์ เกณฑ์ผ่าน ≥ 3.5 / 5.0',
    );
  });

  it('judges exactly at the pass mark as passed', () => {
    expect(ploBarAriaLabel('PLO1', 'x', 70, 70)).toContain('ผ่านเกณฑ์');
    expect(ploBarAriaLabel('PLO1', 'x', 70, 70)).not.toContain('ยังไม่ผ่าน');
  });

  it('follows the real pass mark of the curriculum', () => {
    expect(ploBarAriaLabel('PLO1', 'x', 50, 60)).toContain('เกณฑ์ผ่าน ≥ 3.0 / 5.0');
  });

  it('with no data still names the pass mark; with no pass mark it is just the name', () => {
    expect(ploBarAriaLabel('PLO1', 'x', null, 70)).toBe(
      'PLO1 x — ไม่มีข้อมูล เกณฑ์ผ่าน ≥ 3.5 / 5.0',
    );
    expect(ploBarAriaLabel('PLO1', 'x', 50, null)).toBe('PLO1 x');
  });
});
