import type { CloPloMappingItem } from '@eduanalyze-ai/shared-types';
import { describeApiError } from '@/lib/describe-api-error';
import { rejectedFields } from './clo-edit';
import { PLO_WRITE_ERRORS } from './plo-edit';

// Logic of the "PLO ที่ CLO นี้ตอบ" list in the CLO panel. The panel edits a draft (which PLOs
// one CLO answers, and the weight of each) and saves the difference to the stored links.

export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 5;
// Weight given to a PLO when it is first ticked (the middle of 1-5).
export const DEFAULT_WEIGHT = 3;

export const WEIGHT_OPTIONS = [1, 2, 3, 4, 5] as const;

export const WEIGHT_HELP =
  'น้ำหนัก 1–5 บอกว่า CLO นี้มีผลต่อคะแนน PLO ข้อนั้นมากแค่ไหน (มาก = มีผลมาก) ผล PLO ของนิสิตคิดเป็นค่าเฉลี่ยถ่วงน้ำหนักของ CLO ที่ตอบ PLO ข้อนั้น';

// ploId -> weight; a PLO that is not in the draft is not answered by this CLO.
export type LinkDraft = Record<string, number>;

export function draftFromMappings(mappings: CloPloMappingItem[]): LinkDraft {
  const draft: LinkDraft = {};
  for (const m of mappings) draft[m.ploId] = m.weight;
  return draft;
}

export interface LinkDiff {
  creates: { ploId: string; weight: number }[];
  updates: { id: string; ploId: string; weight: number }[];
  removes: { id: string; ploId: string }[];
}

// `stored` must be the links of this one CLO.
export function diffLinks(stored: CloPloMappingItem[], draft: LinkDraft): LinkDiff {
  const diff: LinkDiff = { creates: [], updates: [], removes: [] };
  const seen = new Set<string>();
  for (const m of stored) {
    seen.add(m.ploId);
    const weight = draft[m.ploId];
    if (weight === undefined) diff.removes.push({ id: m.id, ploId: m.ploId });
    else if (weight !== m.weight) diff.updates.push({ id: m.id, ploId: m.ploId, weight });
  }
  for (const [ploId, weight] of Object.entries(draft)) {
    if (!seen.has(ploId)) diff.creates.push({ ploId, weight });
  }
  return diff;
}

// Ticking adds the PLO with the default weight (or keeps the weight already chosen);
// unticking takes it out of the draft.
export function setLinked(draft: LinkDraft, ploId: string, linked: boolean): LinkDraft {
  const next = { ...draft };
  if (linked) next[ploId] = next[ploId] ?? DEFAULT_WEIGHT;
  else delete next[ploId];
  return next;
}

export function setWeight(draft: LinkDraft, ploId: string, weight: number): LinkDraft {
  if (draft[ploId] === undefined) return draft;
  return {
    ...draft,
    [ploId]: Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.round(weight))),
  };
}

export function describeMappingError(error: unknown): string {
  const fields = rejectedFields(error);
  if (fields.length > 0) {
    return `เซิร์ฟเวอร์ไม่รับข้อมูลช่อง: ${fields.join(', ')} — รีสตาร์ท backend ให้เป็นเวอร์ชันล่าสุดแล้วลองใหม่`;
  }
  return describeApiError(error, PLO_WRITE_ERRORS);
}
