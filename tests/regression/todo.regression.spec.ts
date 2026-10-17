import { test, expect } from '@playwright/test';

async function add(page: import('@playwright/test').Page, ...items: string[]) {
  for (const item of items) {
    await page.getByPlaceholder('What needs to be done?').fill(item);
    await page.getByPlaceholder('What needs to be done?').press('Enter');
  }
}

test.describe('todo regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
  });

  test('counter shows remaining items', async ({ page }) => {
    await add(page, 'one', 'two', 'three');
    await expect(page.getByTestId('todo-count')).toContainText('3 items left');
    await page.getByRole('checkbox', { name: 'Toggle Todo' }).first().check();
    await expect(page.getByTestId('todo-count')).toContainText('2 items left');
  });

  test('active and completed filters work', async ({ page }) => {
    await add(page, 'keep', 'done');
    await page.getByTestId('todo-item').nth(1).getByRole('checkbox').check();
    await page.getByRole('link', { name: 'Active' }).click();
    await expect(page.getByTestId('todo-title')).toHaveText(['keep']);
    await page.getByRole('link', { name: 'Completed' }).click();
    await expect(page.getByTestId('todo-title')).toHaveText(['done']);
  });

  test('todo can be deleted', async ({ page }) => {
    await add(page, 'temp');
    await page.getByTestId('todo-item').hover();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByTestId('todo-item')).toHaveCount(0);
  });
});
