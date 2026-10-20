import type { CloPloMappingItem } from '@eduanalyze-ai/shared-types';
import { describeApiError } from '@/lib/describe-api-error';
import { rejectedFields } from './clo-edit';
import { PLO_WRITE_ERRORS } from './plo-edit';

// Logic of the CLO↔PLO link page. The page edits a draft (which PLOs each CLO is linked to,
// and the weight) and saves the difference to the stored links in one go.

export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 5;
// Weight given to a link when it is first ticked (the middle of 1-5).
export const DEFAULT_WEIGHT = 3;

export const WEIGHT_OPTIONS = [1, 2, 3, 4, 5] as const;

// cloId:ploId -> weight; a pair that is not in the draft is not linked.
export type MappingDraft = Record<string, number>;

export const mappingKey = (cloId: string, ploId: string) => `${cloId}:${ploId}`;

export function draftFromMappings(mappings: CloPloMappingItem[]): MappingDraft {
  const draft: MappingDraft = {};
  for (const m of mappings) draft[mappingKey(m.cloId, m.ploId)] = m.weight;
  return draft;
}

export interface MappingDiff {
  creates: { cloId: string; ploId: string; weight: number }[];
  updates: { id: string; cloId: string; ploId: string; weight: number }[];
  removes: { id: string; cloId: string; ploId: string }[];
}

// Only links of `cloIds` (the selected course) are looked at, so a link of another course
// is never removed because it is missing from the draft.
export function diffMappings(
  stored: CloPloMappingItem[],
  draft: MappingDraft,
  cloIds: string[],
): MappingDiff {
  const scope = new Set(cloIds);
  const diff: MappingDiff = { creates: [], updates: [], removes: [] };
  const seen = new Set<string>();
  for (const m of stored) {
    if (!scope.has(m.cloId)) continue;
    const key = mappingKey(m.cloId, m.ploId);
    seen.add(key);
    const weight = draft[key];
    if (weight === undefined) diff.removes.push({ id: m.id, cloId: m.cloId, ploId: m.ploId });
    else if (weight !== m.weight) {
      diff.updates.push({ id: m.id, cloId: m.cloId, ploId: m.ploId, weight });
    }
  }
  for (const [key, weight] of Object.entries(draft)) {
    if (seen.has(key)) continue;
    const [cloId, ploId] = key.split(':');
    if (scope.has(cloId)) diff.creates.push({ cloId, ploId, weight });
  }
  return diff;
}

export function diffCount(diff: MappingDiff): number {
  return diff.creates.length + diff.updates.length + diff.removes.length;
}

export function diffSummary(diff: MappingDiff): string {
  const parts = [
    diff.creates.length > 0 ? `เพิ่มการเชื่อมโยง ${diff.creates.length} รายการ` : null,
    diff.updates.length > 0 ? `เปลี่ยนน้ำหนัก ${diff.updates.length} รายการ` : null,
    diff.removes.length > 0 ? `ลบการเชื่อมโยง ${diff.removes.length} รายการ` : null,
  ].filter((p): p is string => p !== null);
  return parts.join(' · ');
}

export const MAPPING_SAVE_NOTE = 'การเปลี่ยนแปลงนี้มีผลกับผล PLO ของนิสิตทุกคนในหลักสูตรนี้ทันที';

// Ticking links with the default weight; unticking removes the pair from the draft.
export function setLinked(
  draft: MappingDraft,
  cloId: string,
  ploId: string,
  linked: boolean,
): MappingDraft {
  const next = { ...draft };
  const key = mappingKey(cloId, ploId);
  if (linked) next[key] = next[key] ?? DEFAULT_WEIGHT;
  else delete next[key];
  return next;
}

export function setWeight(
  draft: MappingDraft,
  cloId: string,
  ploId: string,
  weight: number,
): MappingDraft {
  const key = mappingKey(cloId, ploId);
  if (draft[key] === undefined) return draft;
  return { ...draft, [key]: Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.round(weight))) };
}

export function describeMappingError(error: unknown): string {
  const fields = rejectedFields(error);
  if (fields.length > 0) {
    return `เซิร์ฟเวอร์ไม่รับข้อมูลช่อง: ${fields.join(', ')} — รีสตาร์ท backend ให้เป็นเวอร์ชันล่าสุดแล้วลองใหม่`;
  }
  return describeApiError(error, PLO_WRITE_ERRORS);
}
