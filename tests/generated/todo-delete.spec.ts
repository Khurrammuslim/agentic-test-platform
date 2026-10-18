// AUTO-GENERATED from charters/todo-delete.md. NEEDS HUMAN REVIEW before moving to tests/regression.
import { test, expect } from '@playwright/test';

async function add(page: import('@playwright/test').Page, item: string) {
  await page.getByPlaceholder('What needs to be done?').fill(item);
  await page.getByPlaceholder('What needs to be done?').press('Enter');
}

test.describe('todo regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
  });

  test('delete a todo', async ({ page }) => {
    await add(page, 'temp');
    await page.getByTestId('todo-item').hover();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByTestId('todo-item')).toHaveCount(0);
    await expect(page.getByTestId('todo-count')).toHaveCount(0); // QUESTION: Should the counter be visible when no items are left?
  });
});
