import type { CoursePloEntry, InstructorCourseSummary } from '@eduanalyze-ai/shared-types';
import { buildCloPloMatrix, buildCoursePloMatrix, describeTopPlos } from './plo-clo-chart';

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

describe('buildCoursePloMatrix', () => {
  it('has a row per course by code and a column per linked PLO in PLO1 to PLOn order', () => {
    const m = buildCoursePloMatrix([
      course('b', 'CS200', [
        plo('PLO10', [['x', 2]]),
        plo('PLO2', [
          ['x', 1],
          ['y', 4],
        ]),
      ]),
      course('a', 'CS100', [plo('PLO2', [['z', 3]])]),
    ]);
    expect(m.plos.map((p) => p.code)).toEqual(['PLO2', 'PLO10']);
    expect(m.rows.map((r) => r.code)).toEqual(['CS100', 'CS200']);
    expect(m.rows[0].cells.map((c) => c?.total ?? null)).toEqual([3, null]);
    expect(m.rows[1].cells.map((c) => c?.total ?? null)).toEqual([5, 2]);
    expect(m.isEmpty).toBe(false);
  });

  it('uses the weight as the colour step up to 5 and spreads a bigger total over the five steps', () => {
    const small = buildCoursePloMatrix([
      course('a', 'A', [plo('PLO1', [['x', 4]]), plo('PLO2', [['x', 1]])]),
    ]);
    expect(small.rows[0].cells.map((c) => c?.level)).toEqual([4, 1]);
    const big = buildCoursePloMatrix([
      course('a', 'A', [
        plo('PLO1', [
          ['x', 5],
          ['y', 5],
        ]),
        plo('PLO2', [['x', 1]]),
      ]),
    ]);
    expect(big.rows[0].cells.map((c) => c?.level)).toEqual([5, 1]);
  });

  it('keeps a course with no mapping as a row of empty cells, and a single course works', () => {
    const m = buildCoursePloMatrix([
      course('a', 'CS100', [plo('PLO1', [['x', 2]])]),
      course('b', 'CS200', [plo('PLO1', [])]),
    ]);
    expect(m.rows[1].cells).toEqual([null]);
    expect(
      buildCoursePloMatrix([course('a', 'CS100', [plo('PLO1', [['x', 2]])])]).rows,
    ).toHaveLength(1);
  });

  it('keeps two PLOs that share a code but belong to different curricula apart', () => {
    const m = buildCoursePloMatrix([
      course('a', 'A', [plo('PLO1', [['x', 1]], 'p-x')]),
      course('b', 'B', [plo('PLO1', [['x', 1]], 'p-y')]),
    ]);
    expect(m.plos.map((p) => p.ploId)).toEqual(['p-x', 'p-y']);
  });

  it('is empty with no course, no PLO, or no mapping', () => {
    expect(buildCoursePloMatrix([]).isEmpty).toBe(true);
    expect(buildCoursePloMatrix([course('a', 'CS1', [])]).isEmpty).toBe(true);
    expect(buildCoursePloMatrix([course('a', 'CS1', [plo('PLO1', [])])]).isEmpty).toBe(true);
  });
});
