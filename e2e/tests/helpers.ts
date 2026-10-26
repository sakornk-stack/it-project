import { expect, type Page } from '@playwright/test';

export type Role = 'student' | 'instructor' | 'staff' | 'admin' | 'superadmin';

export const PASSWORD = process.env.E2E_PASSWORD ?? 'DemoPass123!';

export const ACCOUNTS: Record<Role, string> = {
  student: 'demo-student@test.local',
  instructor: 'demo-instructor@test.local',
  staff: 'demo-staff@test.local',
  admin: 'demo-admin@test.local',
  superadmin: 'demo-superadmin@test.local',
};

// Mirrors homeRouteForRole in apps/frontend/src/lib/dashboard-routes.ts.
export const HOME: Record<Role, string> = {
  student: '/dashboard',
  instructor: '/instructor/dashboard',
  staff: '/staff/dashboard',
  admin: '/admin/overview',
  superadmin: '/superadmin/system-overview',
};

// POST /auth/login allows 5 attempts per minute per IP. Every login in the run
// goes through here, so a full run waits instead of tripping the limit. The
// list lives for the whole worker process (workers: 1), across test files.
const loginAttempts: number[] = [];
async function waitForLoginSlot(page: Page) {
  const windowMs = 61_000;
  while (loginAttempts.length && Date.now() - loginAttempts[0] > windowMs) loginAttempts.shift();
  if (loginAttempts.length >= 5) await page.waitForTimeout(windowMs - (Date.now() - loginAttempts[0]));
  loginAttempts.push(Date.now());
}

export async function submitLogin(page: Page, email: string, password: string) {
  for (let attempt = 1; ; attempt++) {
    await waitForLoginSlot(page);
    await page.goto('/login');
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', password);
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/auth/login') && r.request().method() === 'POST'),
      page.click('button[type=submit]'),
    ]);
    // Attempts made before this run (another run, a person using the app)
    // count too; if the limit is already used up, wait it out once.
    if (res.status() !== 429 || attempt > 1) return;
    loginAttempts.length = 0;
    await page.waitForTimeout(61_000);
  }
}

export async function loginAs(page: Page, role: Role) {
  await submitLogin(page, ACCOUNTS[role], PASSWORD);
  await expect(page).toHaveURL(new RegExp(`${HOME[role]}$`));
}

// API responses with status >= 400 while a page loads. The session probes on
// mount (/auth/refresh, /auth/me) are expected to 401 now and then.
export function collectApiErrors(page: Page) {
  const errors: string[] = [];
  page.on('response', (res) => {
    const url = res.url();
    if (res.status() >= 400 && url.includes('/api/') && !/\/auth\/(refresh|me)\b/.test(url)) {
      errors.push(`${res.status()} ${url.replace(/^.*\/api/, '/api')}`);
    }
  });
  return errors;
}

export async function settle(page: Page) {
  // Some pages keep a request open (polling), so networkidle may never come.
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'page is wider than the screen').toBeLessThanOrEqual(1);
}
