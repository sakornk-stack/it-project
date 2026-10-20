import { AxiosError, type AxiosResponse } from 'axios';
import type { PloListItem } from '@eduanalyze-ai/shared-types';
import {
  describePloError,
  ploEditSchema,
  plosOfCurriculum,
  toCreatePloBody,
  toUpdatePloBody,
} from './plo-edit';

const PLO: PloListItem = {
  id: 'p1',
  code: 'PLO1',
  name: 'บูรณาการความรู้',
  description: null,
  curriculumId: 'cur-1',
};

function httpError(status: number, message: unknown) {
  return new AxiosError('x', undefined, undefined, undefined, {
    status,
    data: { message },
  } as AxiosResponse);
}

describe('ploEditSchema', () => {
  const ok = { code: 'PLO1', name: 'n', description: '' };
  it('accepts a blank description', () => {
    expect(ploEditSchema.safeParse(ok).success).toBe(true);
  });
  it('requires code and name, and caps code at 20 and name at 255', () => {
    expect(ploEditSchema.safeParse({ ...ok, code: ' ' }).success).toBe(false);
    expect(ploEditSchema.safeParse({ ...ok, name: '' }).success).toBe(false);
    expect(ploEditSchema.safeParse({ ...ok, code: 'x'.repeat(21) }).success).toBe(false);
    expect(ploEditSchema.safeParse({ ...ok, name: 'x'.repeat(256) }).success).toBe(false);
  });
});

describe('request bodies', () => {
  it('create leaves a blank description out', () => {
    expect(toCreatePloBody('cur-1', { code: ' PLO2 ', name: ' n ', description: ' ' })).toEqual({
      curriculumId: 'cur-1',
      code: 'PLO2',
      name: 'n',
    });
  });
  it('update sends a cleared description as empty text', () => {
    expect(toUpdatePloBody({ code: 'PLO1', name: 'n', description: '' }).description).toBe('');
  });
});

describe('plosOfCurriculum', () => {
  it('keeps only this curriculum, in natural order', () => {
    const all = [
      { ...PLO, id: 'a', code: 'PLO10' },
      { ...PLO, id: 'b', code: 'PLO2' },
      { ...PLO, id: 'c', code: 'PLO1', curriculumId: 'other' },
    ];
    expect(plosOfCurriculum(all, 'cur-1').map((p) => p.code)).toEqual(['PLO2', 'PLO10']);
  });
});

describe('describePloError', () => {
  it('shows the Thai reason of a blocked delete', () => {
    const message = 'ลบ PLO นี้ไม่ได้ เพราะยังมีการเชื่อมโยงกับ CLO 4 รายการ ให้ลบการเชื่อมโยงก่อน';
    expect(describePloError(httpError(409, message))).toBe(message);
  });
  it('names the field the API refused', () => {
    expect(describePloError(httpError(400, ['property foo should not exist']))).toContain('foo');
  });
  it('names the scope problem on 403', () => {
    expect(describePloError(httpError(403, 'Forbidden'))).toContain('นอกขอบเขต');
  });
});
