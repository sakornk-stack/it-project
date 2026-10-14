import { idsToExpandForLevel, splitByTerm } from './org-tree-view';

const ids = { faculties: ['f1', 'f2'], departments: ['d1'], programs: ['p1'] };

describe('idsToExpandForLevel', () => {
  it('opens only the ancestors of the level asked for', () => {
    expect([...idsToExpandForLevel('faculty', ids)]).toEqual([]);
    expect([...idsToExpandForLevel('department', ids)]).toEqual(['f1', 'f2']);
    expect([...idsToExpandForLevel('program', ids)]).toEqual(['f1', 'f2', 'd1']);
    expect([...idsToExpandForLevel('curriculum', ids)]).toEqual(['f1', 'f2', 'd1', 'p1']);
  });
});

describe('splitByTerm', () => {
  it('returns the text whole when there is no term', () => {
    expect(splitByTerm('คณะวิศวกรรม', '  ')).toEqual([{ text: 'คณะวิศวกรรม', match: false }]);
  });

  it('marks every match, keeping the original casing', () => {
    expect(splitByTerm('IT it It', 'it')).toEqual([
      { text: 'IT', match: true },
      { text: ' ', match: false },
      { text: 'it', match: true },
      { text: ' ', match: false },
      { text: 'It', match: true },
    ]);
  });

  it('keeps text around a match', () => {
    expect(splitByTerm('คณะวิทยาศาสตร์', 'วิทยา')).toEqual([
      { text: 'คณะ', match: false },
      { text: 'วิทยา', match: true },
      { text: 'ศาสตร์', match: false },
    ]);
  });

  it('is plain when nothing matches', () => {
    expect(splitByTerm('abc', 'z')).toEqual([{ text: 'abc', match: false }]);
  });
});
