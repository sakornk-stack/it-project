import { defaultSemesterId, groupSemestersByYear, selectableCourseIds } from './batch-record';

const semesters = [
  { id: 's66-2', year: 2566, term: 'SECOND' as const },
  { id: 's67-1', year: 2567, term: 'FIRST' as const },
  { id: 's66-1', year: 2566, term: 'FIRST' as const },
  { id: 's66-3', year: 2566, term: 'SUMMER' as const },
  { id: 'orphan', year: undefined, term: 'FIRST' as const },
];

describe('groupSemestersByYear', () => {
  it('groups by year newest first, terms in teaching order, drops unknown years', () => {
    expect(groupSemestersByYear(semesters)).toEqual([
      { year: 2567, terms: [{ term: 'FIRST', semesterId: 's67-1' }] },
      {
        year: 2566,
        terms: [
          { term: 'FIRST', semesterId: 's66-1' },
          { term: 'SECOND', semesterId: 's66-2' },
          { term: 'SUMMER', semesterId: 's66-3' },
        ],
      },
    ]);
  });
});

describe('defaultSemesterId', () => {
  const years = groupSemestersByYear(semesters);

  it('suggests the next regular term after the latest recorded one, skipping summer', () => {
    expect(defaultSemesterId(years, new Set(['s66-1']))).toBe('s66-2');
    expect(defaultSemesterId(years, new Set(['s66-2']))).toBe('s67-1');
    expect(defaultSemesterId(years, new Set(['s66-1', 's66-3']))).toBe('s67-1');
  });

  it('stays on the newest term when it is already recorded', () => {
    expect(defaultSemesterId(years, new Set(['s67-1']))).toBe('s67-1');
  });

  it('starts at the first term of the newest year with no records', () => {
    expect(defaultSemesterId(years, new Set())).toBe('s67-1');
    expect(defaultSemesterId([], new Set())).toBeNull();
  });
});

describe('selectableCourseIds', () => {
  const all = ['c1', 'c2', 'c3', 'c4'];

  it('hides courses picked in other rows and already recorded in the semester', () => {
    expect(selectableCourseIds(all, ['c1', 'c2', null], 2, new Set(['c4']))).toEqual(['c3']);
  });

  it('keeps the row its own current pick', () => {
    expect(selectableCourseIds(all, ['c1', 'c2'], 0, new Set())).toEqual(['c1', 'c3', 'c4']);
  });
});
