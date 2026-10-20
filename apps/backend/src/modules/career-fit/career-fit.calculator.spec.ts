import { Grade } from '@prisma/client';
import { CareerInput, computeCareerFit } from './career-fit.calculator';

const course = (id: string, weight: number) => ({
  weight,
  courseId: id,
  code: `C${id}`,
  name: `วิชา ${id}`,
});
const career = (id: string, ids: [string, number][], sortOrder = 0): CareerInput => ({
  id,
  name: `สาย ${id}`,
  sortOrder,
  courses: ids.map(([c, w]) => course(c, w)),
});
const grades = (o: Record<string, Grade>) => new Map(Object.entries(o));

describe('computeCareerFit', () => {
  it('weights the score: sum(w*score)/sum(w)', () => {
    const r = computeCareerFit(
      [
        career('x', [
          ['1', 3],
          ['2', 1],
          ['3', 1],
        ]),
      ],
      grades({ '1': 'A', '2': 'C', '3': 'C' }),
    );
    expect(r.careers[0].score).toBe(80); // (300+50+50)/5
    expect(r.careers[0].level).toBe('HIGH');
  });

  it('excludes S/W/I and ungraded courses (not counted as 0)', () => {
    const r = computeCareerFit(
      [
        career('x', [
          ['1', 1],
          ['2', 1],
          ['3', 1],
          ['4', 1],
          ['5', 1],
          ['6', 1],
        ]),
      ],
      grades({ '1': 'A', '2': 'A', '3': 'A', '4': 'S', '5': 'W' }),
    );
    expect(r.careers[0].score).toBe(100);
    expect(r.careers[0].gradedCourseCount).toBe(3);
    expect(r.careers[0].coverage).toBe(0.5);
    expect(r.careers[0].recommendedCourses.map((c) => c.code)).toEqual(['C4', 'C5', 'C6']);
  });

  it('counts F and U as 0', () => {
    const r = computeCareerFit(
      [
        career('x', [
          ['1', 1],
          ['2', 1],
          ['3', 1],
        ]),
      ],
      grades({ '1': 'A', '2': 'F', '3': 'U' }),
    );
    expect(r.careers[0].score).toBe(33.33);
    expect(r.careers[0].level).toBe('LOW');
  });

  it('uses the grade given (caller resolves the latest retake attempt)', () => {
    const r = computeCareerFit(
      [
        career('x', [
          ['1', 1],
          ['2', 1],
          ['3', 1],
        ]),
      ],
      grades({ '1': 'B', '2': 'B', '3': 'B' }),
    );
    expect(r.careers[0].score).toBe(75);
    expect(r.careers[0].level).toBe('HIGH');
  });

  it('marks fewer than 3 graded courses INSUFFICIENT_DATA with no score', () => {
    const r = computeCareerFit(
      [
        career('x', [
          ['1', 1],
          ['2', 1],
          ['3', 1],
        ]),
        career('y', [
          ['4', 1],
          ['5', 1],
          ['6', 1],
        ]),
      ],
      grades({ '1': 'A', '2': 'A', '4': 'B', '5': 'B', '6': 'B' }),
    );
    expect(r.careers.map((c) => c.careerId)).toEqual(['y', 'x']);
    expect(r.careers[1]).toMatchObject({ status: 'INSUFFICIENT_DATA', score: null, level: null });
    expect(r.careers[1].message).toMatch(/น้อยกว่า 3 วิชา/);
  });

  it('ranks by score descending and keeps file order on ties', () => {
    const base: [string, number][] = [
      ['1', 1],
      ['2', 1],
      ['3', 1],
    ];
    const r = computeCareerFit(
      [
        career('low', base, 0),
        career(
          'tieB',
          [
            ['4', 1],
            ['5', 1],
            ['6', 1],
          ],
          2,
        ),
        career(
          'tieA',
          [
            ['7', 1],
            ['8', 1],
            ['9', 1],
          ],
          1,
        ),
      ],
      grades({
        '1': 'C',
        '2': 'C',
        '3': 'C',
        '4': 'A',
        '5': 'A',
        '6': 'A',
        '7': 'A',
        '8': 'A',
        '9': 'A',
      }),
    );
    expect(r.careers.map((c) => c.careerId)).toEqual(['tieA', 'tieB', 'low']);
  });

  it('boundaries: 62.5 is MEDIUM, below is LOW', () => {
    const r = computeCareerFit(
      [
        career('m', [
          ['1', 1],
          ['2', 1],
          ['3', 1],
        ]),
        career('l', [
          ['4', 1],
          ['5', 1],
          ['6', 1],
        ]),
      ],
      grades({ '1': 'C_PLUS', '2': 'C_PLUS', '3': 'C_PLUS', '4': 'C', '5': 'C', '6': 'C_PLUS' }),
    );
    expect(r.careers.find((c) => c.careerId === 'm')!.level).toBe('MEDIUM');
    expect(r.careers.find((c) => c.careerId === 'l')!.level).toBe('LOW');
  });

  it('top courses: max 3 by score, with code, name and grade', () => {
    const r = computeCareerFit(
      [
        career('x', [
          ['1', 1],
          ['2', 1],
          ['3', 1],
          ['4', 1],
        ]),
      ],
      grades({ '1': 'C', '2': 'A', '3': 'B', '4': 'B_PLUS' }),
    );
    expect(r.careers[0].topCourses).toEqual([
      { code: 'C2', name: 'วิชา 2', grade: 'A' },
      { code: 'C4', name: 'วิชา 4', grade: 'B_PLUS' },
      { code: 'C3', name: 'วิชา 3', grade: 'B' },
    ]);
  });

  it('recommends not-yet-taken courses by weight desc, max 3', () => {
    const r = computeCareerFit(
      [
        career('x', [
          ['1', 1],
          ['2', 1],
          ['3', 1],
          ['4', 1],
          ['5', 3],
          ['6', 2],
          ['7', 2],
        ]),
      ],
      grades({ '1': 'A', '2': 'A', '3': 'A' }),
    );
    expect(r.careers[0].recommendedCourses.map((c) => c.code)).toEqual(['C5', 'C6', 'C7']);
  });

  it('returns NO_GRADES with an empty list when nothing is scored', () => {
    const c = [career('x', [['1', 1]])];
    expect(computeCareerFit(c, grades({}))).toMatchObject({ status: 'NO_GRADES', careers: [] });
    expect(computeCareerFit(c, grades({ '1': 'S' })).status).toBe('NO_GRADES');
  });

  it('returns NO_CAREERS when the curriculum has none', () => {
    expect(computeCareerFit([], grades({ '1': 'A' }))).toMatchObject({
      status: 'NO_CAREERS',
      careers: [],
    });
  });

  it('carries description and group through and does not let the group change score or rank', () => {
    const ids: [string, number][] = [
      ['1', 1],
      ['2', 1],
      ['3', 1],
    ];
    const group = { id: 'g', name: 'กลุ่ม', description: null, sortOrder: 2 };
    const plain = computeCareerFit([career('x', ids)], grades({ '1': 'B', '2': 'B', '3': 'B' }));
    const grouped = computeCareerFit(
      [{ ...career('x', ids), description: 'อธิบาย', group }],
      grades({ '1': 'B', '2': 'B', '3': 'B' }),
    );
    expect(plain.careers[0]).toMatchObject({ description: null, group: null });
    expect(grouped.careers[0]).toMatchObject({ description: 'อธิบาย', group });
    expect(grouped.careers[0].score).toBe(plain.careers[0].score);
    expect(grouped.careers[0].level).toBe(plain.careers[0].level);
  });
});
