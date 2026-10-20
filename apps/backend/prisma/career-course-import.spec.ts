// Run on demand (not part of `npm test`, whose jest rootDir is src/):
//   npx jest --rootDir=. --roots=prisma --testRegex 'career-course-import\.spec\.ts$'
import {
  courseIdsInScope,
  parseCareerImportOptions,
  rowCurriculumError,
  selectStaleLinks,
} from './career-course-import';

describe('parseCareerImportOptions', () => {
  it('is legacy mode (no curriculum, no errors) when the option is absent', () => {
    expect(parseCareerImportOptions(['--apply', '--file=x.csv', '--no-additions'])).toEqual({
      curriculum: undefined,
      errors: [],
    });
  });

  it.each(['2569', '2564'])('accepts --curriculum=%s', (year) => {
    const r = parseCareerImportOptions([`--curriculum=${year}`, '--file=x.csv']);
    expect(r.curriculum).toBe(year);
    expect(r.errors).toEqual([]);
  });

  it.each(['2565', '', 'both', '25641'])('rejects --curriculum=%p', (value) => {
    const r = parseCareerImportOptions([`--curriculum=${value}`]);
    expect(r.curriculum).toBeUndefined();
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('2569 หรือ 2564');
  });

  it('rejects a bare --curriculum instead of silently running in legacy mode', () => {
    const r = parseCareerImportOptions(['--curriculum', '2564']);
    expect(r.curriculum).toBeUndefined();
    expect(r.errors).toHaveLength(1);
  });

  it('rejects giving --curriculum twice', () => {
    const r = parseCareerImportOptions(['--curriculum=2569', '--curriculum=2564']);
    expect(r.errors).toEqual(['--curriculum ระบุได้ครั้งเดียว']);
  });

  it('refuses --curriculum together with --additions-file', () => {
    const r = parseCareerImportOptions(['--curriculum=2569', '--additions-file=a.csv']);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('--additions-file');
  });

  it('allows --additions-file without --curriculum (legacy)', () => {
    expect(parseCareerImportOptions(['--additions-file=a.csv']).errors).toEqual([]);
  });
});

describe('rowCurriculumError', () => {
  it('accepts an empty cell, a missing column and a matching year', () => {
    expect(rowCurriculumError('', '2569')).toBeNull();
    expect(rowCurriculumError('  ', '2564')).toBeNull();
    expect(rowCurriculumError(undefined, '2569')).toBeNull();
    expect(rowCurriculumError('2569', '2569')).toBeNull();
    expect(rowCurriculumError(' 2564 ', '2564')).toBeNull();
  });

  it('rejects a different year, both and garbage', () => {
    expect(rowCurriculumError('2564', '2569')).toBe('curriculum-mismatch');
    expect(rowCurriculumError('2569', '2564')).toBe('curriculum-mismatch');
    expect(rowCurriculumError('both', '2569')).toBe('curriculum-mismatch');
    expect(rowCurriculumError('x', '2564')).toBe('curriculum-mismatch');
  });

  it('ignores the column entirely in legacy mode', () => {
    expect(rowCurriculumError('2564', undefined)).toBeNull();
    expect(rowCurriculumError('anything', undefined)).toBeNull();
  });
});

describe('stale-link scope', () => {
  const source = ['s1', 's2', 's3'];
  const target = ['t1', 't2'];
  const active = [
    { id: 'l1', courseId: 's1' },
    { id: 'l2', courseId: 's2' },
    { id: 'l3', courseId: 't1' },
    { id: 'l4', courseId: 't2' },
    { id: 'l5', courseId: 'outside-program' },
  ];

  it('2569 run only closes 2569 links, never 2564 ones', () => {
    const scope = courseIdsInScope('2569', source, target);
    const stale = selectStaleLinks(active, scope, new Set(['s1']));
    expect(stale.map((l) => l.id)).toEqual(['l2']);
  });

  it('2564 run only closes 2564 links, never 2569 ones', () => {
    const scope = courseIdsInScope('2564', source, target);
    const stale = selectStaleLinks(active, scope, new Set(['t2']));
    expect(stale.map((l) => l.id)).toEqual(['l3']);
  });

  it('an empty wanted set for the year closes only that year', () => {
    const stale = selectStaleLinks(active, courseIdsInScope('2564', source, target), undefined);
    expect(stale.map((l) => l.id)).toEqual(['l3', 'l4']);
  });

  it('legacy mode (no option) keeps the old scope: both years', () => {
    const scope = courseIdsInScope(undefined, source, target);
    expect([...scope].sort()).toEqual(['s1', 's2', 's3', 't1', 't2']);
    const stale = selectStaleLinks(active, scope, new Set(['s1', 't1']));
    expect(stale.map((l) => l.id)).toEqual(['l2', 'l4']);
  });

  it('never touches links to courses outside both curricula', () => {
    for (const year of ['2569', '2564', undefined] as const) {
      const stale = selectStaleLinks(active, courseIdsInScope(year, source, target), undefined);
      expect(stale.map((l) => l.courseId)).not.toContain('outside-program');
    }
  });
});
