import { expect, test } from '@playwright/test';

test('login screen renders the authentication form', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Chào mừng trở lại!' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng nhập hệ thống' })).toBeVisible();
});

test('unauthenticated finance navigation redirects to login', async ({ page }) => {
  await page.goto('/finance');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Chào mừng trở lại!' })).toBeVisible();
});

test('authenticated sessions expire after 30 minutes without activity', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    localStorage.setItem('dreamhigh-auth-storage', JSON.stringify({
      state: {
        user: { id: 1, email: 'staff@example.test', fullName: 'Test Staff', roles: ['STAFF'], branchIds: [1] },
        token: 'test-token',
        isAuthenticated: true,
      },
      version: 0,
    }));
  });
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const body = url.includes('/reports/arrears')
      ? { data: { totals: { totalDebt: 0, studentCount: 0, overdueTotal: 0 }, items: [] }, meta: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } }
      : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/finance');
  await expect(page.getByRole('heading', { name: 'Tài chính' })).toBeVisible();
  await page.clock.fastForward(30 * 60 * 1000);

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Chào mừng trở lại!' })).toBeVisible();
});