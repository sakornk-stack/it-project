import type { CloPloMappingItem } from '@eduanalyze-ai/shared-types';
import {
  DEFAULT_WEIGHT,
  diffCount,
  diffMappings,
  diffSummary,
  draftFromMappings,
  mappingKey,
  setLinked,
  setWeight,
} from './mapping-edit';

const stored: CloPloMappingItem[] = [
  { id: 'm1', cloId: 'c1', ploId: 'p1', weight: 3 },
  { id: 'm2', cloId: 'c1', ploId: 'p2', weight: 2 },
  { id: 'm3', cloId: 'other', ploId: 'p1', weight: 5 },
];

describe('draft', () => {
  it('starts from the stored links', () => {
    expect(draftFromMappings(stored)[mappingKey('c1', 'p2')]).toBe(2);
  });

  it('ticking links with the default weight, unticking drops the pair', () => {
    const ticked = setLinked({}, 'c1', 'p3', true);
    expect(ticked[mappingKey('c1', 'p3')]).toBe(DEFAULT_WEIGHT);
    expect(setLinked(ticked, 'c1', 'p3', false)).toEqual({});
  });

  it('ticking again keeps the weight already chosen', () => {
    const d = { [mappingKey('c1', 'p1')]: 5 };
    expect(setLinked(d, 'c1', 'p1', true)[mappingKey('c1', 'p1')]).toBe(5);
  });

  it('keeps the weight within 1-5 and ignores an unlinked pair', () => {
    const d = { [mappingKey('c1', 'p1')]: 3 };
    expect(setWeight(d, 'c1', 'p1', 9)[mappingKey('c1', 'p1')]).toBe(5);
    expect(setWeight(d, 'c1', 'p1', 0)[mappingKey('c1', 'p1')]).toBe(1);
    expect(setWeight(d, 'c1', 'p2', 4)).toBe(d);
  });
});

describe('diffMappings', () => {
  it('has no changes for an untouched draft', () => {
    const diff = diffMappings(stored, draftFromMappings(stored), ['c1']);
    expect(diffCount(diff)).toBe(0);
  });

  it('splits creates, weight changes and removals', () => {
    let draft = draftFromMappings(stored);
    draft = setWeight(draft, 'c1', 'p1', 4);
    draft = setLinked(draft, 'c1', 'p2', false);
    draft = setLinked(draft, 'c1', 'p3', true);
    const diff = diffMappings(stored, draft, ['c1']);
    expect(diff.updates).toEqual([{ id: 'm1', cloId: 'c1', ploId: 'p1', weight: 4 }]);
    expect(diff.removes).toEqual([{ id: 'm2', cloId: 'c1', ploId: 'p2' }]);
    expect(diff.creates).toEqual([{ cloId: 'c1', ploId: 'p3', weight: DEFAULT_WEIGHT }]);
    expect(diffSummary(diff)).toBe(
      'เพิ่มการเชื่อมโยง 1 รายการ · เปลี่ยนน้ำหนัก 1 รายการ · ลบการเชื่อมโยง 1 รายการ',
    );
  });

  it('never touches links of CLOs outside the selected course', () => {
    const draft = draftFromMappings(stored);
    delete draft[mappingKey('other', 'p1')];
    expect(diffCount(diffMappings(stored, draft, ['c1']))).toBe(0);
  });
});
