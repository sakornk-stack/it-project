import { expect, test } from '@playwright/test';
import { ACCOUNTS, HOME, loginAs, submitLogin } from './helpers';

test.describe('การเข้าสู่ระบบ', () => {
  test('TC-E2E-01 รหัสผ่านผิดเข้าสู่ระบบไม่ได้', async ({ page }) => {
    await submitLogin(page, ACCOUNTS.student, 'wrong-password-123');
    await expect(page.getByText('อีเมลหรือรหัสผ่านไม่ถูกต้อง')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-E2E-02 เข้าสู่ระบบ ออกจากระบบ แล้วเปิดหน้าที่ต้องเข้าสู่ระบบไม่ได้', async ({ page }) => {
    await loginAs(page, 'student');
    await expect(page.locator('main')).toBeVisible();

    await page.getByRole('button', { name: 'ออกจากระบบ' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto(HOME.student);
    await expect(page).toHaveURL(/\/login/);
  });
});
