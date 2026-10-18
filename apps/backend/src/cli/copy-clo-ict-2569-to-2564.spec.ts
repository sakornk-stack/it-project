import {
  planCopy,
  report,
  SourceCourse,
  TargetCourse,
} from '../../prisma/copy-clo-ict-2569-to-2564';

// Pure logic only: the script's database reads and writes are not exercised here.

const PLO_IDS = new Map([
  ['PLO1', 'plo-id-1'],
  ['PLO2', 'plo-id-2'],
  ['PLO3', 'plo-id-3'],
]);

const target = (code: string, activeCloCount = 0): TargetCourse => ({
  id: `target-${code}`,
  code,
  activeCloCount,
});

const source = (code: string, clos: SourceCourse['clos'] = []): SourceCourse => ({ code, clos });

const clo = (code: string, ploCodes: string[] = [], weight = 1) => ({
  code,
  description: `SECRET-TEXT-${code}`,
  mappings: ploCodes.map((ploCode) => ({ ploCode, weight })),
});

const plan = (t: TargetCourse[], s: SourceCourse[], plos = PLO_IDS) =>
  planCopy({ target: t, source: s, ploIdByCode: plos });

describe('planCopy: matching by course code', () => {
  it('copies only courses whose code is in both curricula', () => {
    const result = plan(
      [target('A001'), target('B002')],
      [source('A001', [clo('CLO1')]), source('C003', [clo('CLO1')])],
    );

    expect(result.matched).toBe(1);
    expect(result.create.map((c) => c.courseCode)).toEqual(['A001']);
    expect(result.create[0].courseId).toBe('target-A001');
    expect(result.notIn2564).toEqual(['C003']);
  });

  it('never matches on anything but the code (same code only)', () => {
    const result = plan([target('A001')], [source('A002', [clo('CLO1')])]);
    expect(result.matched).toBe(0);
    expect(result.create).toEqual([]);
    expect(result.notIn2564).toEqual(['A002']);
  });

  it('does not list a 2569 course without CLOs as missing from 2564', () => {
    const result = plan([target('A001')], [source('Z999')]);
    expect(result.notIn2564).toEqual([]);
  });
});

describe('planCopy: skips', () => {
  it('skips a 2564 course that already has an active CLO, whatever 2569 holds', () => {
    const result = plan(
      [target('A001', 2), target('B002')],
      [source('A001', [clo('CLO1'), clo('CLO2')]), source('B002', [clo('CLO1')])],
    );

    expect(result.skippedHasClo).toEqual(['A001']);
    expect(result.create.map((c) => c.courseCode)).toEqual(['B002']);
    expect(result.cloCount).toBe(1);
  });

  it('skips a matched course that has no CLO in 2569 and reports it as still empty', () => {
    const result = plan([target('A001')], [source('A001')]);

    expect(result.skippedNoCloIn2569).toEqual(['A001']);
    expect(result.create).toEqual([]);
    expect(result.stillWithoutClo).toEqual(['A001']);
  });

  it('is idempotent: once every matched course has CLOs, nothing is left to create', () => {
    const first = plan([target('A001')], [source('A001', [clo('CLO1', ['PLO1'])])]);
    expect(first.create).toHaveLength(1);

    const second = plan([target('A001', 1)], [source('A001', [clo('CLO1', ['PLO1'])])]);
    expect(second.create).toEqual([]);
    expect(second.cloCount).toBe(0);
    expect(second.mappingCount).toBe(0);
    expect(second.skippedHasClo).toEqual(['A001']);
  });
});

describe('planCopy: still without a CLO afterwards', () => {
  it('lists unmatched and no-CLO courses but not the ones that get a copy or already have one', () => {
    const result = plan(
      [target('A001'), target('B002'), target('C003', 1), target('D004')],
      [source('A001', [clo('CLO1')]), source('B002')],
    );

    expect(result.stillWithoutClo).toEqual(['B002', 'D004']);
  });
});

describe('planCopy: CLO copy', () => {
  it('keeps code and text, ordered by CLO number rather than as text', () => {
    const result = plan(
      [target('A001')],
      [source('A001', [clo('CLO10'), clo('CLO2'), clo('CLO1')])],
    );

    expect(result.create[0].clos.map((c) => c.code)).toEqual(['CLO1', 'CLO2', 'CLO10']);
    expect(result.create[0].clos[0].description).toBe('SECRET-TEXT-CLO1');
    expect(result.cloCount).toBe(3);
  });
});

describe('planCopy: CLO to PLO links', () => {
  it('links to the 2564 PLO with the same code and keeps the original weight', () => {
    const result = plan([target('A001')], [source('A001', [clo('CLO1', ['PLO2', 'PLO1'], 3)])]);

    expect(result.create[0].clos[0].mappings).toEqual([
      { ploCode: 'PLO2', ploId: 'plo-id-2', weight: 3 },
      { ploCode: 'PLO1', ploId: 'plo-id-1', weight: 3 },
    ]);
    expect(result.mappingCount).toBe(2);
  });

  it('skips a link whose PLO code does not exist in 2564 and counts it', () => {
    const result = plan([target('A001')], [source('A001', [clo('CLO1', ['PLO1', 'PLO9'])])]);

    expect(result.create[0].clos[0].mappings.map((m) => m.ploCode)).toEqual(['PLO1']);
    expect(result.create[0].clos[0].skippedMappings).toBe(1);
    expect(result.skippedMappingCount).toBe(1);
  });

  it('still copies the CLO when none of its PLOs exist in 2564', () => {
    const result = plan([target('A001')], [source('A001', [clo('CLO1', ['PLO1'])])], new Map());

    expect(result.cloCount).toBe(1);
    expect(result.mappingCount).toBe(0);
    expect(result.skippedMappingCount).toBe(1);
  });

  it('does not link the same PLO twice', () => {
    const result = plan([target('A001')], [source('A001', [clo('CLO1', ['PLO1', 'PLO1'])])]);
    expect(result.create[0].clos[0].mappings).toHaveLength(1);
  });
});

describe('report', () => {
  const result = plan(
    [target('A001'), target('B002', 1), target('C003')],
    [
      source('A001', [clo('CLO1', ['PLO1', 'PLO9'])]),
      source('B002', [clo('CLO1')]),
      source('D004', [clo('CLO1')]),
    ],
  );

  it('prints counts and course codes, never CLO text', () => {
    const text = report(result, PLO_IDS.size, false).join('\n');

    expect(text).toContain('A001');
    expect(text).toContain('B002');
    expect(text).toContain('D004');
    expect(text).toContain('C003');
    expect(text).not.toContain('SECRET-TEXT');
  });

  it('always warns that the 2564 PLOs are not yet confirmed', () => {
    for (const apply of [false, true]) {
      expect(report(result, PLO_IDS.size, apply).join('\n')).toContain('ยังไม่ได้ยืนยัน');
    }
  });

  it('words the totals as planned in a dry run and as done after --apply', () => {
    expect(report(result, 3, false).join('\n')).toContain('CLO ที่จะสร้าง: 1');
    expect(report(result, 3, true).join('\n')).toContain('CLO ที่สร้าง: 1');
  });
});
