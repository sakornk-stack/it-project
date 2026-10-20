import type {
  CloDetail,
  CloPloMappingItem,
  CreateCloPloMappingRequest,
  CreateCloRequest,
  UpdateCloPloMappingRequest,
  UpdateCloRequest,
} from '@eduanalyze-ai/shared-types';
import { describeCloError, toCreateCloBody, toUpdateCloBody, type CloEditValues } from './clo-edit';
import { describeMappingError, diffLinks, type LinkDraft } from './mapping-edit';

// Saving one CLO from its panel is several API calls in order: the CLO itself, then each PLO
// it answers (remove, change weight, add). The calls cannot be one transaction, so a failure
// stops the run and the result says what already went through.

export interface SaveApi {
  createClo: (dto: CreateCloRequest) => Promise<{ id: string }>;
  updateClo: (id: string, dto: UpdateCloRequest) => Promise<unknown>;
  deleteClo: (id: string) => Promise<unknown>;
  createMapping: (dto: CreateCloPloMappingRequest) => Promise<unknown>;
  updateMapping: (id: string, dto: UpdateCloPloMappingRequest) => Promise<unknown>;
  deleteMapping: (id: string) => Promise<unknown>;
}

export interface RunResult {
  // Set once the CLO exists, so a retry after a failed later step updates instead of re-adding.
  cloId: string | null;
  done: string[];
  failed: { step: string; reason: string } | null;
}

export interface SaveInput {
  clo: Pick<CloDetail, 'id'> | null;
  courseId: string;
  values: CloEditValues;
  // Links of this CLO as stored now.
  stored: CloPloMappingItem[];
  draft: LinkDraft;
  ploCode: (ploId: string) => string;
}

export async function saveCloWithLinks(api: SaveApi, input: SaveInput): Promise<RunResult> {
  const result: RunResult = {
    cloId: input.clo?.id ?? null,
    done: [],
    failed: null,
  };

  const run = async (
    step: string,
    call: () => Promise<unknown>,
    describe = describeMappingError,
  ) => {
    try {
      await call();
      result.done.push(step);
      return true;
    } catch (error) {
      result.failed = { step, reason: describe(error) };
      return false;
    }
  };

  if (result.cloId) {
    const id = result.cloId;
    if (
      !(await run(
        'บันทึกข้อความ CLO',
        () => api.updateClo(id, toUpdateCloBody(input.values)),
        describeCloError,
      ))
    ) {
      return result;
    }
  } else {
    const ok = await run(
      'เพิ่ม CLO',
      async () => {
        const created = await api.createClo(toCreateCloBody(input.courseId, input.values));
        result.cloId = created.id;
      },
      describeCloError,
    );
    if (!ok) return result;
  }
  const cloId = result.cloId as string;

  const diff = diffLinks(input.stored, input.draft);
  for (const r of diff.removes) {
    if (!(await run(`เอา ${input.ploCode(r.ploId)} ออก`, () => api.deleteMapping(r.id))))
      return result;
  }
  for (const u of diff.updates) {
    const step = `เปลี่ยนน้ำหนัก ${input.ploCode(u.ploId)} เป็น ${u.weight}`;
    if (!(await run(step, () => api.updateMapping(u.id, { weight: u.weight })))) return result;
  }
  for (const c of diff.creates) {
    const step = `เพิ่ม ${input.ploCode(c.ploId)} (น้ำหนัก ${c.weight})`;
    if (!(await run(step, () => api.createMapping({ cloId, ploId: c.ploId, weight: c.weight })))) {
      return result;
    }
  }
  return result;
}

// Deleting a CLO first takes it out of the PLOs it answers (the server refuses to delete a
// CLO that still answers one), then deletes it.
export async function deleteCloWithLinks(
  api: SaveApi,
  input: {
    clo: Pick<CloDetail, 'id'>;
    stored: CloPloMappingItem[];
    ploCode: (ploId: string) => string;
  },
): Promise<RunResult> {
  const result: RunResult = { cloId: input.clo.id, done: [], failed: null };
  for (const m of input.stored) {
    const step = `เอา ${input.ploCode(m.ploId)} ออก`;
    try {
      await api.deleteMapping(m.id);
      result.done.push(step);
    } catch (error) {
      result.failed = { step, reason: describeMappingError(error) };
      return result;
    }
  }
  try {
    await api.deleteClo(input.clo.id);
    result.done.push('ลบ CLO');
  } catch (error) {
    result.failed = { step: 'ลบ CLO', reason: describeCloError(error) };
  }
  return result;
}

// One plain sentence for the panel: the reason, then what already went through.
export function describeFailure(result: RunResult): string | null {
  if (!result.failed) return null;
  const { step, reason } = result.failed;
  const head = `ไม่สำเร็จที่ขั้น "${step}": ${reason}`;
  return result.done.length > 0
    ? `${head} — ที่ทำสำเร็จไปแล้ว: ${result.done.join(', ')}`
    : `${head} — ยังไม่มีอะไรถูกบันทึก`;
}
