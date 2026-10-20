import { isAxiosError } from 'axios';
import type { CloDetail, CreateCloRequest, UpdateCloRequest } from '@eduanalyze-ai/shared-types';
import { describeApiError } from '@/lib/describe-api-error';
import { cloSchema, type CloFormValues } from '@/lib/validation/clo.schema';

// Form logic for the ADMIN outcomes page, kept out of the components so it can be tested.
export const cloEditSchema = cloSchema;
export type CloEditValues = CloFormValues;

export const CLO_EMPTY: CloEditValues = {
  code: '',
  description: '',
  achievementThreshold: '',
  isConfirmed: true,
};

export function cloToFormValues(clo: CloDetail): CloEditValues {
  return {
    code: clo.code,
    description: clo.description,
    achievementThreshold: clo.achievementThreshold === null ? '' : String(clo.achievementThreshold),
    isConfirmed: clo.isConfirmed,
  };
}

export function toCreateCloBody(courseId: string, values: CloEditValues): CreateCloRequest {
  return {
    courseId,
    code: values.code.trim(),
    description: values.description.trim(),
    ...(values.achievementThreshold === ''
      ? {}
      : { achievementThreshold: Number(values.achievementThreshold) }),
    isConfirmed: values.isConfirmed,
  };
}

// A cleared threshold is sent as null so the CLO goes back to the curriculum default.
export function toUpdateCloBody(values: CloEditValues): UpdateCloRequest {
  return {
    code: values.code.trim(),
    description: values.description.trim(),
    achievementThreshold:
      values.achievementThreshold === '' ? null : Number(values.achievementThreshold),
    isConfirmed: values.isConfirmed,
  };
}

// Natural order, so CLO2 comes before CLO10.
export function sortClos(clos: CloDetail[]): CloDetail[] {
  return [...clos].sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
}

export function unconfirmedCount(clos: CloDetail[]): number {
  return clos.filter((c) => !c.isConfirmed).length;
}

export const CLO_EFFECT_WARNING =
  'การแก้ไขหรือลบ CLO มีผลกับผล CLO/PLO ของนิสิตทุกคนในหลักสูตรนี้ทันที';

export const CLO_DELETE_WARNING =
  'CLO นี้จะถูกปิดใช้งาน ลบไม่ได้หากยังเชื่อมโยงกับ PLO หรือมีคะแนนการประเมินรายวิชาอยู่';

export function cloDeleteTitle(clo: Pick<CloDetail, 'code'>): string {
  return `ลบ ${clo.code}?`;
}

export function cloConfirmTitle(clo: Pick<CloDetail, 'code'>): string {
  return `ยืนยัน ${clo.code}?`;
}

export const CLO_WRITE_ERRORS: Partial<Record<number, string>> = {
  403: 'คุณไม่มีสิทธิ์แก้ไข CLO ของหลักสูตรนี้ — อยู่นอกขอบเขตที่คุณดูแล',
  404: 'ไม่พบ CLO นี้แล้ว อาจถูกลบไปก่อนหน้า',
};

// Only this course's CLOs, in natural order. The server already filters by course; this keeps the
// list and the "not confirmed" count right even if an older API answers with every CLO.
export function closOfCourse(clos: CloDetail[], courseId: string): CloDetail[] {
  return sortClos(clos.filter((c) => c.courseId === courseId));
}

// The API's validation text is English ("property isConfirmed should not exist"), which describeApiError
// hides; the field names in it are what the user can act on, so they are named in a Thai sentence.
export function rejectedFields(error: unknown): string[] {
  if (!isAxiosError(error) || error.response?.status !== 400) return [];
  const message = (error.response.data as { message?: unknown } | undefined)?.message;
  const parts = Array.isArray(message) ? message : [message];
  const names = parts
    .filter((m): m is string => typeof m === 'string')
    .map((m) => /^(?:property )?(\w+)/.exec(m)?.[1])
    .filter((n): n is string => !!n);
  return [...new Set(names)];
}

// A blocked delete or a duplicate code is a 409 whose Thai message says why, so it is shown as is.
export function describeCloError(error: unknown): string {
  const fields = rejectedFields(error);
  if (fields.length > 0) {
    return `เซิร์ฟเวอร์ไม่รับข้อมูลช่อง: ${fields.join(', ')} — ตรวจค่าที่กรอก หรือรีสตาร์ท backend ให้เป็นเวอร์ชันล่าสุดแล้วลองใหม่`;
  }
  return describeApiError(error, CLO_WRITE_ERRORS);
}
