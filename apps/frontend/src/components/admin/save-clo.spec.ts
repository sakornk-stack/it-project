import { AxiosError, type AxiosResponse } from 'axios';
import type { CloPloMappingItem } from '@eduanalyze-ai/shared-types';
import { deleteCloWithLinks, describeFailure, saveCloWithLinks, type SaveApi } from './save-clo';

const values = {
  code: 'CLO1',
  description: 'd',
  achievementThreshold: '50',
  isConfirmed: true,
};
const stored: CloPloMappingItem[] = [
  { id: 'm1', cloId: 'c1', ploId: 'p1', weight: 3 },
  { id: 'm2', cloId: 'c1', ploId: 'p2', weight: 2 },
];
const ploCode = (id: string) => id.toUpperCase();

function httpError(status: number, message: string) {
  return new AxiosError('x', undefined, undefined, undefined, {
    status,
    data: { message },
  } as AxiosResponse);
}

function api(overrides: Partial<SaveApi> = {}): SaveApi & Record<keyof SaveApi, jest.Mock> {
  return {
    createClo: jest.fn().mockResolvedValue({ id: 'new' }),
    updateClo: jest.fn().mockResolvedValue({}),
    deleteClo: jest.fn().mockResolvedValue({}),
    createMapping: jest.fn().mockResolvedValue({}),
    updateMapping: jest.fn().mockResolvedValue({}),
    deleteMapping: jest.fn().mockResolvedValue({}),
    ...overrides,
  } as never;
}

describe('saveCloWithLinks', () => {
  it('updates the CLO, then removes, re-weights and adds links in that order', async () => {
    const a = api();
    const calls: string[] = [];
    for (const name of ['updateClo', 'deleteMapping', 'updateMapping', 'createMapping'] as const) {
      a[name].mockImplementation(async () => calls.push(name));
    }
    const result = await saveCloWithLinks(a, {
      clo: { id: 'c1' },
      courseId: 'course',
      values,
      stored,
      draft: { p1: 4, p3: 2 },
      ploCode,
    });
    expect(calls).toEqual(['updateClo', 'deleteMapping', 'updateMapping', 'createMapping']);
    expect(a.deleteMapping).toHaveBeenCalledWith('m2');
    expect(a.updateMapping).toHaveBeenCalledWith('m1', { weight: 4 });
    expect(a.createMapping).toHaveBeenCalledWith({
      cloId: 'c1',
      ploId: 'p3',
      weight: 2,
    });
    expect(result.failed).toBeNull();
    expect(describeFailure(result)).toBeNull();
  });

  it('a new CLO is created first and its id is used for the links', async () => {
    const a = api();
    const result = await saveCloWithLinks(a, {
      clo: null,
      courseId: 'course',
      values,
      stored: [],
      draft: { p1: 3 },
      ploCode,
    });
    expect(a.createClo).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId: 'course',
        code: 'CLO1',
        achievementThreshold: 50,
      }),
    );
    expect(a.createMapping).toHaveBeenCalledWith({
      cloId: 'new',
      ploId: 'p1',
      weight: 3,
    });
    expect(result.cloId).toBe('new');
  });

  it('stops at the first failure and says what already went through', async () => {
    const a = api({
      updateMapping: jest.fn().mockRejectedValue(httpError(403, 'Forbidden')),
    } as never);
    const result = await saveCloWithLinks(a, {
      clo: { id: 'c1' },
      courseId: 'course',
      values,
      stored,
      draft: { p1: 5 },
      ploCode,
    });
    expect(a.createMapping).not.toHaveBeenCalled();
    expect(result.done).toEqual(['บันทึกข้อความ CLO', 'เอา P2 ออก']);
    const text = describeFailure(result) as string;
    expect(text).toContain('เปลี่ยนน้ำหนัก P1 เป็น 5');
    expect(text).toContain('นอกขอบเขต');
    expect(text).toContain('บันทึกข้อความ CLO, เอา P2 ออก');
  });

  it('a failed CLO step changes nothing else and says nothing was saved', async () => {
    const a = api({
      updateClo: jest.fn().mockRejectedValue(httpError(409, 'รหัส CLO "CLO1" ถูกใช้แล้วในวิชานี้')),
    } as never);
    const result = await saveCloWithLinks(a, {
      clo: { id: 'c1' },
      courseId: 'course',
      values,
      stored,
      draft: {},
      ploCode,
    });
    expect(a.deleteMapping).not.toHaveBeenCalled();
    expect(describeFailure(result)).toContain('ถูกใช้แล้ว');
    expect(describeFailure(result)).toContain('ยังไม่มีอะไรถูกบันทึก');
  });

  it('keeps the new CLO id when a later step fails, so a retry updates instead of re-adding', async () => {
    const a = api({
      createMapping: jest.fn().mockRejectedValue(httpError(500, 'x')),
    } as never);
    const result = await saveCloWithLinks(a, {
      clo: null,
      courseId: 'course',
      values,
      stored: [],
      draft: { p1: 3 },
      ploCode,
    });
    expect(result.cloId).toBe('new');
    expect(result.failed?.step).toBe('เพิ่ม P1 (น้ำหนัก 3)');
  });
});

describe('deleteCloWithLinks', () => {
  it('takes the CLO out of its PLOs, then deletes it', async () => {
    const a = api();
    const result = await deleteCloWithLinks(a, {
      clo: { id: 'c1' },
      stored,
      ploCode,
    });
    expect(a.deleteMapping).toHaveBeenCalledTimes(2);
    expect(a.deleteClo).toHaveBeenCalledWith('c1');
    expect(result.failed).toBeNull();
  });

  it('does not delete the CLO when a link could not be removed', async () => {
    const a = api({
      deleteMapping: jest.fn().mockRejectedValue(httpError(404, 'x')),
    } as never);
    const result = await deleteCloWithLinks(a, {
      clo: { id: 'c1' },
      stored,
      ploCode,
    });
    expect(a.deleteClo).not.toHaveBeenCalled();
    expect(describeFailure(result)).toContain('เอา P1 ออก');
  });

  it('shows the server reason when the delete itself is refused', async () => {
    const reason = 'ลบ CLO นี้ไม่ได้ เพราะยังมีข้อมูลผูกอยู่: คะแนนการประเมินรายวิชา 2 รายการ';
    const a = api({
      deleteClo: jest.fn().mockRejectedValue(httpError(409, reason)),
    } as never);
    const result = await deleteCloWithLinks(a, {
      clo: { id: 'c1' },
      stored: [],
      ploCode,
    });
    expect(describeFailure(result)).toContain(reason);
  });
});
