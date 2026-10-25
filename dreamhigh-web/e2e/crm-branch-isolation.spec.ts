import { expect, test } from '@playwright/test';

test.describe('CRM & Role Scoping', () => {
  test('staff user can access /crm/students and views branch-scoped student list', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'dreamhigh-auth-storage',
        JSON.stringify({
          state: {
            user: {
              id: 2,
              email: 'staff.hn@example.test',
              fullName: 'Hanoi Staff',
              roles: ['STAFF'],
              branchIds: [1],
            },
            token: 'test-staff-token',
            isAuthenticated: true,
          },
          version: 0,
        }),
      );
    });

    await page.route('**/api/students*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 101,
            studentCode: 'HV-HN-001',
            fullName: 'Nguyen Van Hanoi',
            dob: '2010-05-15',
            status: 'ACTIVE',
            parent: { fullName: 'Nguyen Van Bo', phone: '0912345678' },
          },
        ]),
      });
    });

    await page.goto('/crm/students');

    await expect(page.getByRole('heading', { name: 'Danh sách Học viên' })).toBeVisible();
    await expect(page.getByText('Nguyen Van Hanoi')).toBeVisible();
    await expect(page.getByText('HV-HN-001')).toBeVisible();
  });

  test('staff user cannot access /admin/users (admin-only route)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'dreamhigh-auth-storage',
        JSON.stringify({
          state: {
            user: {
              id: 2,
              email: 'staff.hn@example.test',
              fullName: 'Hanoi Staff',
              roles: ['STAFF'],
              branchIds: [1],
            },
            token: 'test-staff-token',
            isAuthenticated: true,
          },
          version: 0,
        }),
      );
    });

    await page.goto('/admin/users');

    // ProtectedRoute with allowedRoles=['ADMIN'] redirects non-admin users to /dashboard or /login
    await expect(page).not.toHaveURL(/\/admin\/users$/);
  });
});

