import { AxiosError } from 'axios';
import {
  describeReactivateError,
  inactiveCoursesSummary,
  reactivateTitle,
  REACTIVATE_NOTE,
} from './inactive-courses';

function apiError(status: number, message: string) {
  return new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    data: { message },
  } as never);
}

describe('inactive courses', () => {
  it('names the course in the confirmation and warns that prerequisites do not come back', () => {
    expect(reactivateTitle({ code: 'CPE101', name: 'ชื่อ' })).toBe(
      'เปิดใช้งานรายวิชา CPE101 ชื่อ?',
    );
    expect(REACTIVATE_NOTE).toContain('วิชาบังคับก่อน');
  });

  it('shows the Thai 409 reason as is', () => {
    const message =
      'เปิดใช้งานไม่ได้ เพราะรหัสวิชา "CPE101" ถูกใช้โดยวิชาอื่นที่ใช้งานอยู่ในหลักสูตรนี้';
    expect(describeReactivateError(apiError(409, message))).toBe(message);
  });

  it('explains a 403 as out of scope and never shows English text', () => {
    expect(describeReactivateError(apiError(403, 'Forbidden'))).toContain('อยู่นอกขอบเขต');
    expect(describeReactivateError(apiError(404, 'Course x not found'))).not.toMatch(/[A-Za-z]/);
    expect(describeReactivateError(new Error('Network Error'))).toBe(
      'เปิดใช้งานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    );
  });

  it('summarises the count', () => {
    expect(inactiveCoursesSummary(0)).toBe('ไม่มีรายวิชาที่ปิดใช้งาน');
    expect(inactiveCoursesSummary(3)).toBe('รายวิชาที่ปิดใช้งาน 3 วิชา');
  });
});
