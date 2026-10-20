import type { RadarPoint } from '@eduanalyze-ai/shared-types';
import { interpretPloRadar } from './interpret-plo-radar';

function point(code: string, value: number | null): RadarPoint {
  return { ploId: code, code, name: `ด้าน ${code}`, value } as RadarPoint;
}

describe('interpretPloRadar weakness values', () => {
  it('does not show a score equal to the threshold for a PLO just below it', () => {
    const { weaknesses } = interpretPloRadar([point('PLO4', 69.4), point('PLO1', 90)], 70);
    expect(weaknesses[0]).toContain('3.47');
    expect(weaknesses[0]).not.toContain('3.5');
  });

  it('keeps one decimal for a PLO clearly below the threshold', () => {
    const { weaknesses } = interpretPloRadar([point('PLO4', 50), point('PLO1', 90)], 70);
    expect(weaknesses[0]).toContain('2.5');
  });

  it('keeps one decimal in strengths, including a PLO exactly at the threshold', () => {
    const { strengths, weaknesses } = interpretPloRadar([point('PLO1', 70), point('PLO2', 90)], 70);
    expect(strengths.some((s) => s.includes('3.5'))).toBe(true);
    expect(weaknesses).toHaveLength(0);
  });
});

describe('interpretPloRadar PLOs without data', () => {
  it('lists a PLO with no data under noData, never under weaknesses or recommendations', () => {
    const r = interpretPloRadar([point('PLO1', 90), point('PLO2', null)], 70);
    expect(r.weaknesses).toHaveLength(0);
    expect(r.recommendations.join(' ')).not.toContain('ด้าน PLO2');
    expect(r.noData).toHaveLength(1);
    expect(r.noData[0]).toContain('ด้าน PLO2');
  });

  it('counts only PLOs with data in the summary', () => {
    const r = interpretPloRadar([point('PLO1', 90), point('PLO2', null), point('PLO3', null)], 70);
    expect(r.summary).toContain('1 ด้าน');
  });
});
