import { isNavItemActive, navItemsForRole } from './nav-config';

// The menus of every role other than STAFF, copied from before the Staff menu
// changed. If one of these moves, a role other than Staff has had its menu
// altered.
const PINNED: Record<string, [string, string][]> = {
  STUDENT: [
    ['แดชบอร์ด', '/dashboard'],
    ['การติดตามผลการเรียน', '/academic-record'],
    ['ตรวจสอบหน่วยกิต', '/credit-checker'],
    ['การวิเคราะห์ CLO/PLO', '/clo-plo-analysis'],
    ['สรุปความถนัด', '/aptitude-analysis'],
    ['แผนการเรียน', '/learning-path'],
  ],
  INSTRUCTOR: [
    ['แดชบอร์ด', '/instructor/dashboard'],
    ['รายวิชาที่สอน', '/instructor/my-courses'],
    ['นิสิต', '/instructor/students'],
    ['ภาพรวมชั้นปี', '/instructor/year-levels'],
  ],
  SUPER_ADMIN: [
    ['ภาพรวมระบบ', '/superadmin/system-overview'],
    ['ผู้ใช้งาน', '/superadmin/users'],
    ['โครงสร้างองค์กร', '/superadmin/organization'],
    ['ปีการศึกษา', '/superadmin/academic-years'],
  ],
};

describe('navItemsForRole', () => {
  it('gives Admin three items, in this order', () => {
    expect(navItemsForRole('ADMIN').map((i) => [i.label, i.href])).toEqual([
      ['ภาพรวมขอบเขต', '/admin/overview'],
      ['ผู้ใช้งาน', '/admin/users'],
      ['คุณภาพหลักสูตร', '/admin/curriculum'],
    ]);
  });

  it.each(Object.entries(PINNED))('leaves the %s menu as it was', (role, expected) => {
    const items = navItemsForRole(role as never);
    expect(items.map((i) => [i.label, i.href])).toEqual(expected);
    // Only the Staff, Admin and Super Admin menus use prefix matching.
    if (role !== 'SUPER_ADMIN') {
      expect(items.every((i) => i.matchPrefixes === undefined)).toBe(true);
    }
  });

  it('gives Staff three items', () => {
    expect(navItemsForRole('STAFF').map((i) => [i.label, i.href])).toEqual([
      ['ภาพรวม', '/staff/dashboard'],
      ['นิสิต', '/staff/students'],
      ['หลักสูตร', '/staff/curriculum'],
    ]);
  });
});

describe('isNavItemActive', () => {
  const active = (role: string, pathname: string) =>
    navItemsForRole(role as never)
      .filter((i) => isNavItemActive(i, pathname))
      .map((i) => i.label);

  it('keeps the Admin menu lit on the pages below an item', () => {
    expect(active('ADMIN', '/admin/overview')).toEqual(['ภาพรวมขอบเขต']);
    expect(active('ADMIN', '/admin/users')).toEqual(['ผู้ใช้งาน']);
    expect(active('ADMIN', '/admin/users/abc')).toEqual(['ผู้ใช้งาน']);
    expect(active('ADMIN', '/admin/curriculum')).toEqual(['คุณภาพหลักสูตร']);
    expect(active('ADMIN', '/admin/curriculum/abc')).toEqual(['คุณภาพหลักสูตร']);
  });

  it('keeps the Super Admin menu lit below a user, and never on /admin paths', () => {
    expect(active('SUPER_ADMIN', '/superadmin/users/abc')).toEqual(['ผู้ใช้งาน']);
    expect(active('SUPER_ADMIN', '/admin/curriculum/abc')).toEqual([]);
    expect(active('SUPER_ADMIN', '/admin/users/abc')).toEqual([]);
    expect(active('ADMIN', '/superadmin/users/abc')).toEqual([]);
  });

  it('still matches other roles on the exact path only', () => {
    expect(active('STUDENT', '/dashboard')).toEqual(['แดชบอร์ด']);
    expect(active('STUDENT', '/dashboard/extra')).toEqual([]);
    expect(active('INSTRUCTOR', '/instructor/students')).toEqual(['นิสิต']);
  });

  it('keeps the instructor overview lit inside a course page, as before', () => {
    expect(active('INSTRUCTOR', '/instructor/courses/abc')).toEqual(['แดชบอร์ด']);
  });

  it('keeps Staff นิสิต lit on every student tab and on a student page', () => {
    for (const path of [
      '/staff/students',
      '/staff/students/abc',
      '/staff/year-levels',
      '/staff/student-invitations',
    ]) {
      expect(active('STAFF', path)).toEqual(['นิสิต']);
    }
  });

  it('lights one Staff item for the other pages and none for an unknown one', () => {
    expect(active('STAFF', '/staff/dashboard')).toEqual(['ภาพรวม']);
    expect(active('STAFF', '/staff/curriculum')).toEqual(['หลักสูตร']);
    expect(active('STAFF', '/staff/studentsX')).toEqual([]);
  });
});
