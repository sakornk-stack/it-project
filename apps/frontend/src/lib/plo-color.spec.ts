import { ploProgressBarColorClassName, ploStatusTone } from './plo-color';

describe('ploProgressBarColorClassName', () => {
  it('keeps the existing bands', () => {
    expect(ploProgressBarColorClassName(null, 60)).toBe('bg-slate-300');
    expect(ploProgressBarColorClassName(50, null)).toBe('bg-primary');
    expect(ploProgressBarColorClassName(60, 60)).toBe('bg-emerald-600');
    expect(ploProgressBarColorClassName(45, 60)).toBe('bg-amber-500');
    expect(ploProgressBarColorClassName(44.9, 60)).toBe('bg-amber-500');
    expect(ploProgressBarColorClassName(0, 60)).toBe('bg-amber-500');
  });
});

describe('ploStatusTone', () => {
  it('has no tone without a value or a threshold', () => {
    expect(ploStatusTone(null, 60)).toBe('neutral');
    expect(ploStatusTone(50, null)).toBe('neutral');
  });

  it('is success at the threshold and above', () => {
    expect(ploStatusTone(60, 60)).toBe('success');
    expect(ploStatusTone(100, 60)).toBe('success');
  });

  it('is warning anywhere below the threshold, never danger', () => {
    expect(ploStatusTone(59.9, 60)).toBe('warning');
    expect(ploStatusTone(44.9, 60)).toBe('warning');
    expect(ploStatusTone(0, 60)).toBe('warning');
  });

  it('always agrees with the bar colour', () => {
    const tones = {
      'bg-emerald-600': 'success',
      'bg-amber-500': 'warning',
    };
    for (const v of [0, 30, 44.9, 45, 59.9, 60, 80, 100]) {
      expect(ploStatusTone(v, 60)).toBe(
        tones[ploProgressBarColorClassName(v, 60) as keyof typeof tones],
      );
    }
  });
});
