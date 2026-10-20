import type { CreatePloRequest, PloListItem, UpdatePloRequest } from '@eduanalyze-ai/shared-types';
import { describeApiError } from '@/lib/describe-api-error';
import { ploSchema, type PloFormValues } from '@/lib/validation/plo.schema';
import { rejectedFields } from './clo-edit';

// Form logic for the ADMIN PLO page, kept out of the components so it can be tested.
export const ploEditSchema = ploSchema;
export type PloEditValues = PloFormValues;

export const PLO_EMPTY: PloEditValues = { code: '', name: '', description: '' };

export function ploToFormValues(plo: PloListItem): PloEditValues {
  return { code: plo.code, name: plo.name, description: plo.description ?? '' };
}

export function toCreatePloBody(curriculumId: string, values: PloEditValues): CreatePloRequest {
  const description = values.description.trim();
  return {
    curriculumId,
    code: values.code.trim(),
    name: values.name.trim(),
    ...(description ? { description } : {}),
  };
}

// A cleared description is sent as '' so it is cleared, not kept.
export function toUpdatePloBody(values: PloEditValues): UpdatePloRequest {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    description: values.description.trim(),
  };
}

// Natural order, so PLO2 comes before PLO10.
export function sortPlos<T extends { code: string }>(plos: T[]): T[] {
  return [...plos].sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
}

export function plosOfCurriculum(plos: PloListItem[], curriculumId: string): PloListItem[] {
  return sortPlos(plos.filter((p) => p.curriculumId === curriculumId));
}

export const PLO_DELETE_WARNING =
  'PLO นี้จะถูกซ่อนจากรายการ ลบไม่ได้ถ้ายังมี CLO ที่ตอบ PLO นี้อยู่ ให้เอาออกจาก CLO เหล่านั้นก่อน (แก้ที่แท็บ "ตามรายวิชา")';

export function ploDeleteTitle(plo: Pick<PloListItem, 'code'>): string {
  return `ลบ ${plo.code}?`;
}

export const PLO_WRITE_ERRORS: Partial<Record<number, string>> = {
  403: 'คุณไม่มีสิทธิ์แก้ไข PLO ของหลักสูตรนี้ — อยู่นอกขอบเขตที่คุณดูแล',
  404: 'ไม่พบรายการนี้แล้ว อาจถูกลบไปก่อนหน้า',
};

// A blocked delete or a duplicate code is a 409 whose Thai message says why, so it is shown as is.
export function describePloError(error: unknown): string {
  const fields = rejectedFields(error);
  if (fields.length > 0) {
    return `เซิร์ฟเวอร์ไม่รับข้อมูลช่อง: ${fields.join(', ')} — ตรวจค่าที่กรอก หรือรีสตาร์ท backend ให้เป็นเวอร์ชันล่าสุดแล้วลองใหม่`;
  }
  return describeApiError(error, PLO_WRITE_ERRORS);
}
