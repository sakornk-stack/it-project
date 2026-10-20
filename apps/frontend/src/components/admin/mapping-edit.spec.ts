import type { CloPloMappingItem } from '@eduanalyze-ai/shared-types';
import { DEFAULT_WEIGHT, diffLinks, draftFromMappings, setLinked, setWeight } from './mapping-edit';

const stored: CloPloMappingItem[] = [
  { id: 'm1', cloId: 'c1', ploId: 'p1', weight: 3 },
  { id: 'm2', cloId: 'c1', ploId: 'p2', weight: 2 },
];

describe('draft', () => {
  it('starts from the stored links of the CLO', () => {
    expect(draftFromMappings(stored)).toEqual({ p1: 3, p2: 2 });
  });

  it('ticking adds the PLO with the default weight, unticking drops it', () => {
    const ticked = setLinked({}, 'p3', true);
    expect(ticked).toEqual({ p3: DEFAULT_WEIGHT });
    expect(setLinked(ticked, 'p3', false)).toEqual({});
  });

  it('ticking again keeps the weight already chosen', () => {
    expect(setLinked({ p1: 5 }, 'p1', true)).toEqual({ p1: 5 });
  });

  it('keeps the weight within 1-5 and ignores a PLO that is not ticked', () => {
    expect(setWeight({ p1: 3 }, 'p1', 9)).toEqual({ p1: 5 });
    expect(setWeight({ p1: 3 }, 'p1', 0)).toEqual({ p1: 1 });
    const d = { p1: 3 };
    expect(setWeight(d, 'p2', 4)).toBe(d);
  });
});

describe('diffLinks', () => {
  it('has no changes for an untouched draft', () => {
    expect(diffLinks(stored, draftFromMappings(stored))).toEqual({
      creates: [],
      updates: [],
      removes: [],
    });
  });

  it('splits creates, weight changes and removals', () => {
    let draft = draftFromMappings(stored);
    draft = setWeight(draft, 'p1', 4);
    draft = setLinked(draft, 'p2', false);
    draft = setLinked(draft, 'p3', true);
    const diff = diffLinks(stored, draft);
    expect(diff.updates).toEqual([{ id: 'm1', ploId: 'p1', weight: 4 }]);
    expect(diff.removes).toEqual([{ id: 'm2', ploId: 'p2' }]);
    expect(diff.creates).toEqual([{ ploId: 'p3', weight: DEFAULT_WEIGHT }]);
  });

  it('for a new CLO (nothing stored) creates every ticked PLO', () => {
    expect(diffLinks([], { p1: 2, p4: 5 }).creates).toEqual([
      { ploId: 'p1', weight: 2 },
      { ploId: 'p4', weight: 5 },
    ]);
  });
});
