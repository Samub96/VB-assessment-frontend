import { expect, test } from '@playwright/test';

test('login and archive rejected orders', async ({ page }) => {
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'jwt-token',
        tokenType: 'Bearer',
        expiresAt: '2099-01-01T00:00:00Z',
        role: 'ADMIN'
      })
    });
  });

  await page.route('**/api/v1/orders/archive-rejected', async (route) => {
    expect(route.request().headers()['authorization']).toBe('Bearer jwt-token');
    await route.fulfill({ status: 204 });
  });

  await page.goto('/login');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Panel de órdenes' })).toBeVisible();

  const loginRequest = await page.waitForRequest('**/api/v1/auth/login');
  expect(loginRequest.method()).toBe('POST');

  await page.getByRole('button', { name: 'Archivar rechazadas' }).click();

  const archiveRequest = await page.waitForRequest('**/api/v1/orders/archive-rejected');
  expect(archiveRequest.headers()['authorization']).toBe('Bearer jwt-token');
  await expect(page.getByRole('status')).toContainText('Órdenes rechazadas archivadas correctamente.');
});