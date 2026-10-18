import { test, expect } from '../fixtures';

test.describe('todo smoke @smoke', () => {
  test('user can add a todo', async ({ todoPage }) => {
    await todoPage.add('Write test plan');
    await expect(todoPage.titles).toHaveText(['Write test plan']);
  });

  test('user can complete a todo', async ({ todoPage }) => {
    await todoPage.add('Review PR');
    await todoPage.toggleAt(0);
    await expect(todoPage.items).toHaveClass(/completed/);
  });
});
