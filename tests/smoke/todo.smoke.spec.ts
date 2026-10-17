import { test, expect } from '@playwright/test';

test.describe('todo smoke @smoke', () => {
  test('user can add a todo', async ({ page }) => {
    await page.goto('./');
    await page.getByPlaceholder('What needs to be done?').fill('Write test plan');
    await page.getByPlaceholder('What needs to be done?').press('Enter');
    await expect(page.getByTestId('todo-title')).toHaveText(['Write test plan']);
  });

  test('user can complete a todo', async ({ page }) => {
    await page.goto('./');
    await page.getByPlaceholder('What needs to be done?').fill('Review PR');
    await page.getByPlaceholder('What needs to be done?').press('Enter');
    await page.getByRole('checkbox', { name: 'Toggle Todo' }).check();
    await expect(page.getByTestId('todo-item')).toHaveClass(/completed/);
  });
});
