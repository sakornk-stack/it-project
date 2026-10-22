import type { CoursePloEntry, InstructorCourseSummary } from '@eduanalyze-ai/shared-types';
import { buildCloPloMatrix, buildPloStack, describeTopPlos } from './plo-clo-chart';

// Made-up courses only.
function plo(code: string, clos: [string, number][], ploId = code): CoursePloEntry {
  return {
    ploId,
    code,
    name: `ผลลัพธ์ ${code}`,
    achievementPercent: 80,
    cloBreakdown: clos.map(([c, weight]) => ({ cloId: c, code: c, weight })),
  };
}

function course(courseId: string, code: string, plos: CoursePloEntry[]): InstructorCourseSummary {
  return { courseId, code, name: `วิชา ${code}`, plos } as InstructorCourseSummary;
}

const clo = (code: string) => ({ cloId: code, code });

describe('buildCloPloMatrix', () => {
  it('puts PLO columns in code order, CLO rows in natural order, with weights in the cells', () => {
    const m = buildCloPloMatrix(
      [clo('CLO10'), clo('CLO2'), clo('CLO1')],
      [
        plo('PLO10', [['CLO10', 2]]),
        plo('PLO2', [
          ['CLO1', 5],
          ['CLO2', 3],
        ]),
      ],
    );
    expect(m.plos.map((p) => p.code)).toEqual(['PLO2', 'PLO10']);
    expect(m.clos.map((c) => c.code)).toEqual(['CLO1', 'CLO2', 'CLO10']);
    expect(m.clos.map((c) => c.cells)).toEqual([
      [5, null],
      [3, null],
      [null, 2],
    ]);
    expect(m.plos.map((p) => p.total)).toEqual([8, 2]);
    expect(m.isEmpty).toBe(false);
  });

  it('names the PLO with the highest total weight, and all of them on a tie', () => {
    const one = buildCloPloMatrix(
      [clo('A'), clo('B')],
      [
        plo('PLO1', [['A', 2]]),
        plo('PLO2', [
          ['A', 3],
          ['B', 4],
        ]),
      ],
    );
    expect(describeTopPlos(one)).toBe('วิชานี้ช่วย PLO2 มากที่สุด (น้ำหนักรวม 7)');
    const tie = buildCloPloMatrix(
      [clo('A'), clo('B')],
      [plo('PLO1', [['A', 3]]), plo('PLO3', [['B', 3]]), plo('PLO4', [['B', 1]])],
    );
    expect(describeTopPlos(tie)).toBe('วิชานี้ช่วย PLO1, PLO3 มากที่สุด (น้ำหนักรวม 3)');
  });

  it('lists CLOs mapped to no PLO', () => {
    const m = buildCloPloMatrix([clo('A'), clo('B')], [plo('PLO1', [['A', 1]])]);
    expect(m.unlinkedCloCodes).toEqual(['B']);
    expect(m.isEmpty).toBe(false);
  });

  it('is empty with no CLO, no mapping, or only PLOs without a CLO', () => {
    expect(buildCloPloMatrix([], [plo('PLO1', [['A', 1]])]).isEmpty).toBe(true);
    expect(buildCloPloMatrix([clo('A')], []).isEmpty).toBe(true);
    const m = buildCloPloMatrix([clo('A')], [plo('PLO1', [])]);
    expect(m.isEmpty).toBe(true);
    expect(m.plos).toEqual([]);
    expect(describeTopPlos(m)).toBeNull();
  });

  it('leaves out weights of a CLO the course does not list', () => {
    const m = buildCloPloMatrix(
      [clo('A')],
      [
        plo('PLO1', [
          ['A', 2],
          ['GONE', 5],
        ]),
      ],
    );
    expect(m.plos[0].total).toBe(2);
  });
});

describe('buildPloStack', () => {
  it('sums the weights of a course per PLO and orders PLO1 to PLOn', () => {
    const s = buildPloStack([
      course('b', 'CS200', [
        plo('PLO10', [['x', 2]]),
        plo('PLO2', [
          ['x', 1],
          ['y', 4],
        ]),
      ]),
      course('a', 'CS100', [plo('PLO2', [['z', 3]])]),
    ]);
    expect(s.rows.map((r) => r.code)).toEqual(['PLO2', 'PLO10']);
    expect(s.rows[0].total).toBe(8);
    expect(s.rows[0].segments.map((x) => [x.courseCode, x.weight])).toEqual([
      ['CS100', 3],
      ['CS200', 5],
    ]);
    expect(s.legend.map((l) => l.code)).toEqual(['CS100', 'CS200']);
    expect(s.maxTotal).toBe(8);
    expect(s.isEmpty).toBe(false);
  });

  it('draws one bar for a single course', () => {
    const s = buildPloStack([course('a', 'CS100', [plo('PLO1', [['x', 4]])])]);
    expect(s.legend).toHaveLength(1);
    expect(s.rows[0].segments).toHaveLength(1);
  });

  it('keeps a PLO nobody feeds as a row with no segment', () => {
    const s = buildPloStack([course('a', 'CS100', [plo('PLO1', [['x', 4]]), plo('PLO2', [])])]);
    expect(s.rows.map((r) => [r.code, r.total, r.segments.length])).toEqual([
      ['PLO1', 4, 1],
      ['PLO2', 0, 0],
    ]);
  });

  it('wraps colours past the palette and leaves out a course that feeds nothing', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      course(`c${i}`, `CS${100 + i}`, [plo('PLO1', [['x', 1]])]),
    );
    const s = buildPloStack([...many, course('none', 'CS999', [plo('PLO1', [])])]);
    expect(s.legend).toHaveLength(8);
    expect(s.legend[6].colorIndex).toBe(0);
    expect(s.rows[0].segments).toHaveLength(8);
  });

  it('is empty with no course, no PLO, or no mapping', () => {
    expect(buildPloStack([]).isEmpty).toBe(true);
    expect(buildPloStack([course('a', 'CS1', [])]).isEmpty).toBe(true);
    expect(buildPloStack([course('a', 'CS1', [plo('PLO1', [])])]).isEmpty).toBe(true);
  });
});
