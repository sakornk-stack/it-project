import { AxiosError, type AxiosResponse } from 'axios';
import type { CloDetail } from '@eduanalyze-ai/shared-types';
import {
  cloEditSchema,
  cloToFormValues,
  describeCloError,
  sortClos,
  toCreateCloBody,
  toUpdateCloBody,
  unconfirmedCount,
} from './clo-edit';

const CLO: CloDetail = {
  id: 'c1',
  code: 'CLO1',
  description: 'เขียนโปรแกรมได้',
  courseId: 'course-1',
  achievementThreshold: 70,
  isConfirmed: false,
  isActive: true,
};

function httpError(status: number, message: string) {
  return new AxiosError('x', undefined, undefined, undefined, {
    status,
    data: { message },
  } as AxiosResponse);
}

describe('cloEditSchema', () => {
  const ok = {
    code: 'CLO1',
    description: 'd',
    achievementThreshold: '',
    isConfirmed: true,
  };

  it('accepts a blank threshold and 0..100', () => {
    for (const v of ['', '0', '70', '100']) {
      expect(cloEditSchema.safeParse({ ...ok, achievementThreshold: v }).success).toBe(true);
    }
  });

  it.each(['101', '-1', '7.5', 'abc'])('rejects threshold %s', (v) => {
    expect(cloEditSchema.safeParse({ ...ok, achievementThreshold: v }).success).toBe(false);
  });

  it('requires code and description, and caps the code at 20', () => {
    expect(cloEditSchema.safeParse({ ...ok, code: '  ' }).success).toBe(false);
    expect(cloEditSchema.safeParse({ ...ok, description: '' }).success).toBe(false);
    expect(cloEditSchema.safeParse({ ...ok, code: 'x'.repeat(21) }).success).toBe(false);
  });
});

describe('request bodies', () => {
  it('create leaves the threshold out when blank', () => {
    const body = toCreateCloBody('course-1', {
      code: ' CLO2 ',
      description: ' d ',
      achievementThreshold: '',
      isConfirmed: true,
    });
    expect(body).toEqual({
      courseId: 'course-1',
      code: 'CLO2',
      description: 'd',
      isConfirmed: true,
    });
  });

  it('update sends null for a cleared threshold so the default applies again', () => {
    const body = toUpdateCloBody({
      ...cloToFormValues(CLO),
      achievementThreshold: '',
    });
    expect(body.achievementThreshold).toBeNull();
  });

  it('update carries the confirm flag', () => {
    expect(toUpdateCloBody({ ...cloToFormValues(CLO), isConfirmed: true }).isConfirmed).toBe(true);
  });
});

describe('list helpers', () => {
  it('sorts codes naturally and counts unconfirmed ones', () => {
    const clos = ['CLO10', 'CLO2', 'CLO1'].map((code, i) => ({
      ...CLO,
      id: String(i),
      code,
      isConfirmed: code !== 'CLO2',
    }));
    expect(sortClos(clos).map((c) => c.code)).toEqual(['CLO1', 'CLO2', 'CLO10']);
    expect(unconfirmedCount(clos)).toBe(1);
  });
});

describe('describeCloError', () => {
  it('shows the Thai reason of a blocked delete', () => {
    const message = 'ลบ CLO นี้ไม่ได้ เพราะยังมีข้อมูลผูกอยู่: การเชื่อมโยงกับ PLO 3 รายการ';
    expect(describeCloError(httpError(409, message))).toBe(message);
  });

  it('names the scope problem on 403', () => {
    expect(describeCloError(httpError(403, 'Forbidden'))).toContain('นอกขอบเขต');
  });
});
