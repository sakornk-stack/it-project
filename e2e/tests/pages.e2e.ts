import { expect, test } from '@playwright/test';
import { collectApiErrors, expectNoHorizontalScroll, loginAs, settle, type Role } from './helpers';

// Every menu page of each role, opened on a desktop and a phone-sized screen.
const PAGES: Record<Role, string[]> = {
  student: ['/dashboard', '/academic-record', '/credit-checker', '/clo-plo-analysis', '/aptitude-analysis', '/learning-path', '/profile'],
  instructor: ['/instructor/dashboard', '/instructor/my-courses', '/instructor/students', '/instructor/year-levels', '/instructor/advisees', '/profile'],
  staff: ['/staff/dashboard', '/staff/students', '/staff/student-invitations', '/staff/year-levels', '/staff/curriculum', '/profile'],
  admin: ['/admin/overview', '/admin/curriculum', '/admin/curriculum-outcomes', '/admin/users', '/profile'],
  superadmin: ['/superadmin/system-overview', '/superadmin/users', '/superadmin/organization', '/superadmin/academic-years', '/profile'],
};

const LABEL: Record<Role, string> = {
  student: 'นิสิต',
  instructor: 'อาจารย์',
  staff: 'เจ้าหน้าที่',
  admin: 'ผู้ดูแลระบบ',
  superadmin: 'ผู้ดูแลระบบสูงสุด',
};

const SCREENS = [
  { name: 'คอมพิวเตอร์', width: 1366, height: 860 },
  { name: 'โทรศัพท์มือถือ', width: 390, height: 844 },
];

test.describe('เปิดทุกหน้าของแต่ละบทบาท', () => {
  (Object.keys(PAGES) as Role[]).forEach((role, i) => {
    test(`TC-E2E-${String(i + 3).padStart(2, '0')} ${LABEL[role]} เปิดทุกหน้าได้ ไม่มีข้อผิดพลาด และไม่ล้นจอ`, async ({ page }) => {
      await loginAs(page, role);
      const apiErrors = collectApiErrors(page);
      for (const screen of SCREENS) {
        await page.setViewportSize({ width: screen.width, height: screen.height });
        for (const path of PAGES[role]) {
          await test.step(`${path} (${screen.name})`, async () => {
            await page.goto(path);
            await settle(page);
            // Some pages add their own query, e.g. ?curriculumId= on /staff/curriculum.
            await expect(page).toHaveURL(new RegExp(`${path}(\\?.*)?$`));
            await expect(page.locator('main')).toBeVisible();
            await expect(page.getByText('ไม่มีสิทธิ์เข้าถึงหน้านี้')).toHaveCount(0);
            await expectNoHorizontalScroll(page);
          });
        }
      }
      expect(apiErrors, 'API errors while opening pages').toEqual([]);
    });
  });
});
