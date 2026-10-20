// Run on demand (not part of `npm test`, whose jest rootDir is src/):
//   npx jest --rootDir=. --roots=prisma --testRegex 'career-group-import\.spec\.ts$'
import { parseCsv } from './csv-util';
import { DbCareer, DbGroup, parseGroupCsv, planGroupSync } from './career-group-import';

const csv = (text: string) => parseGroupCsv(parseCsv(text));
const HEADER = 'group,group_description,career,description\n';

const GOOD = `${HEADER}G1,,A,desc a\nG1,,B,desc b\nG2,,C,desc c\n`;
const career = (name: string, over: Partial<DbCareer> = {}): DbCareer => ({
  id: `id-${name}`,
  name,
  description: null,
  sortOrder: 0,
  groupId: null,
  ...over,
});
const group = (name: string, over: Partial<DbGroup> = {}): DbGroup => ({
  id: `gid-${name}`,
  name,
  description: null,
  sortOrder: 0,
  ...over,
});

describe('parseGroupCsv', () => {
  it('reads rows in order and accepts empty optional columns', () => {
    const { rows, errors } = csv(GOOD);
    expect(errors).toEqual([]);
    expect(rows.map((r) => [r.group, r.career, r.groupDescription])).toEqual([
      ['G1', 'A', null],
      ['G1', 'B', null],
      ['G2', 'C', null],
    ]);
  });

  it('works without the optional description columns', () => {
    const { rows, errors } = csv('group,career\nG1,A\n');
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ group: 'G1', career: 'A', description: null });
  });

  it('reports missing columns, empty cells, duplicates and conflicting group descriptions', () => {
    expect(csv('group,x\nG,A\n').errors).toEqual(['header: missing-column-career']);
    expect(csv(`${HEADER},,A,\nG,,,\n`).errors).toEqual([
      'line 2: empty-group',
      'line 3: empty-career',
    ]);
    expect(csv(`${HEADER}G,,A,\nG,,A,\n`).errors).toEqual(['line 3: duplicate-career']);
    expect(csv(`${HEADER}G,one,A,\nG,two,B,\n`).errors).toEqual([
      'line 3: group-description-conflict',
    ]);
    expect(csv(HEADER).errors).toEqual(['file: no-rows']);
  });
});

describe('planGroupSync', () => {
  const rows = csv(GOOD).rows;

  it('creates groups in file order and assigns careers sortOrder by row position', () => {
    const plan = planGroupSync(rows, [], [career('A'), career('B'), career('C')]);
    expect(plan.errors).toEqual([]);
    expect(plan.groups.map((g) => [g.name, g.action, g.sortOrder])).toEqual([
      ['G1', 'create', 0],
      ['G2', 'create', 1],
    ]);
    expect(plan.careers.map((c) => [c.name, c.action, c.moved, c.data.sortOrder])).toEqual([
      ['A', 'update', true, undefined],
      ['B', 'update', true, 1],
      ['C', 'update', true, 2],
    ]);
  });

  it('is idempotent: a second run over an up-to-date DB skips everything', () => {
    const g1 = group('G1', { sortOrder: 0 });
    const g2 = group('G2', { sortOrder: 1 });
    const plan = planGroupSync(
      rows,
      [g1, g2],
      [
        career('A', { groupId: g1.id, sortOrder: 0, description: 'desc a' }),
        career('B', { groupId: g1.id, sortOrder: 1, description: 'desc b' }),
        career('C', { groupId: g2.id, sortOrder: 2, description: 'desc c' }),
      ],
    );
    expect(plan.groups.every((g) => g.action === 'skip')).toBe(true);
    expect(plan.careers.every((c) => c.action === 'skip')).toBe(true);
    expect(plan.careers.some((c) => c.descriptionKept)).toBe(false);
  });

  it('fills an empty DB description but keeps and flags a different one', () => {
    const g1 = group('G1');
    const g2 = group('G2', { sortOrder: 1 });
    const plan = planGroupSync(
      rows,
      [g1, g2],
      [
        career('A', { groupId: g1.id, sortOrder: 0, description: null }),
        career('B', { groupId: g1.id, sortOrder: 1, description: 'edited by hand' }),
        career('C', { groupId: g2.id, sortOrder: 2, description: 'desc c' }),
      ],
    );
    const [a, b] = plan.careers;
    expect(a).toMatchObject({ action: 'update', data: { description: 'desc a' } });
    expect(b).toMatchObject({ action: 'skip', descriptionKept: true });
    expect(b.data.description).toBeUndefined();
  });

  it('overwrites a different description only when asked', () => {
    const g1 = group('G1');
    const g2 = group('G2', { sortOrder: 1 });
    const dbCareers = [
      career('A', { groupId: g1.id, sortOrder: 0, description: 'old' }),
      career('B', { groupId: g1.id, sortOrder: 1, description: 'desc b' }),
      career('C', { groupId: g2.id, sortOrder: 2, description: 'desc c' }),
    ];
    const plan = planGroupSync(rows, [g1, g2], dbCareers, { overwriteDescriptions: true });
    expect(plan.careers[0]).toMatchObject({ action: 'update', data: { description: 'desc a' } });
    expect(plan.careers[0].descriptionKept).toBe(false);
  });

  it('never blanks a description: an empty file cell leaves the DB value alone', () => {
    const plan = planGroupSync(
      csv(`${HEADER}G1,,A,\n`).rows,
      [group('G1')],
      [career('A', { groupId: 'gid-G1', description: 'keep me' })],
    );
    expect(plan.careers[0]).toMatchObject({ action: 'skip', data: {}, descriptionKept: false });
  });

  it('moves a career that sits in another group', () => {
    const plan = planGroupSync(
      csv(`${HEADER}G1,,A,\n`).rows,
      [group('G1'), group('G9')],
      [career('A', { groupId: 'gid-G9' })],
    );
    expect(plan.careers[0]).toMatchObject({ action: 'update', moved: true });
  });

  it('reports a career that is not in the DB and plans nothing for it', () => {
    const plan = planGroupSync(rows, [], [career('A'), career('B')]);
    expect(plan.errors).toEqual(['line 4: career-not-found']);
    expect(plan.careers[2]).toMatchObject({ name: 'C', action: 'missing', existing: null });
  });

  it('does not touch careers that are not in the file', () => {
    const plan = planGroupSync(rows, [], [career('A'), career('B'), career('C'), career('Z')]);
    expect(plan.careers.map((c) => c.name)).toEqual(['A', 'B', 'C']);
  });
});
