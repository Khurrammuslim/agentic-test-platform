// AUTO-GENERATED from charters/todo-edit.md. NEEDS HUMAN REVIEW before moving to tests/regression.
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

  test('edit a todo and counter does not change', async ({ page }) => {
    await add(page, 'original');
    await page.getByTestId('todo-item').dblclick();
    await page.keyboard.type(' edited');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('todo-title')).toHaveText(['original edited']);
    await expect(page.getByTestId('todo-count')).toContainText('1 item left');
  });

  test('pressing Escape while editing keeps the old text', async ({ page }) => {
    await add(page, 'original');
    await page.getByTestId('todo-item').dblclick();
    await page.keyboard.type(' edited');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('todo-title')).toHaveText(['original']);
  });
});
