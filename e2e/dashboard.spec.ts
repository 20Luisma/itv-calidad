import { expect, test } from '@playwright/test';

test.describe('ITV de Código — Dashboard E2E', () => {
  test('carga el dashboard sin errores de consola/CSP y muestra las 7 estaciones', async ({
    page
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ITV de Código' })).toBeVisible();
    await expect(page.locator('#station-track .track-node')).toHaveCount(7);
    await expect(page.locator('#btn-stop')).toBeHidden();
    expect(consoleErrors).toEqual([]);
  });

  test('abre y cierra el modal de Integraciones opcionales', async ({ page }) => {
    await page.goto('/');
    await page.locator('#btn-integrations').click();
    await expect(page.locator('#integrations-modal')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar en .env local' })).toBeVisible();
    await page.locator('#btn-close-integrations').click();
    await expect(page.locator('#integrations-modal')).toBeHidden();
  });

  test('caso negativo: ruta inexistente muestra alerta clara de error sin romper la UI', async ({
    page
  }) => {
    await page.goto('/');
    await page.locator('#repo-path').fill('/ruta/inexistente/itv-e2e-check');
    await page.locator('#slow-motion').selectOption('0');
    await page.locator('#btn-start').click();

    const alert = page.locator('#error-banner');
    await expect(alert).toBeVisible({ timeout: 10_000 });
    await expect(alert).toContainText(/no existe/i);
  });
});
