import { expect, test, type Page } from '@playwright/test';
import { loginAs, settle } from './helpers';

// One logged-in student session shared by the tests below.
test.describe.serial('งานของนิสิต', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAs(page, 'student');
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('TC-E2E-08 บันทึกผลการเรียนผ่านหน้าเว็บ แล้วลบออก', async () => {
    await page.goto('/academic-record');
    await settle(page);

    await page.getByRole('button', { name: 'เพิ่มรายวิชา' }).first().click();
    await page.getByLabel('วิชาแถวที่ 1').click();
    // The list only offers courses not yet recorded in the chosen term.
    const option = page.locator('[data-radix-popper-content-wrapper] button[title]').first();
    const title = (await option.getAttribute('title')) ?? '';
    const code = title.split(' — ')[0].trim();
    expect(code, 'a course to add').not.toBe('');
    await option.click();

    await page.getByLabel('เกรดแถวที่ 1').click();
    await page.getByRole('option', { name: 'A', exact: true }).click();

    const deleteButtons = page.getByRole('button', { name: `ลบผลการเรียน ${code}`, exact: true });
    const before = await deleteButtons.count();

    await expect(page.getByText(/^พร้อมบันทึก 1 วิชา/)).toBeVisible();
    // With a single row the button reads just "บันทึก" (N appears from 2 rows up).
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    await expect(deleteButtons).toHaveCount(before + 1);

    // Clean up: the newest term is listed first.
    await deleteButtons.first().click();
    await page.getByRole('button', { name: `ยืนยันลบผลการเรียน ${code}`, exact: true }).click();
    await expect(deleteButtons).toHaveCount(before);
  });

  test('TC-E2E-09 นิสิตเปิดหน้าของเจ้าหน้าที่ไม่ได้', async () => {
    await page.goto('/staff/students');
    await expect(page.getByText('ไม่มีสิทธิ์เข้าถึงหน้านี้')).toBeVisible();
  });
});
