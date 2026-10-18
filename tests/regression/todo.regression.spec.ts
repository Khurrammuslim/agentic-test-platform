import { test, expect } from '../fixtures';

test.describe('todo regression', () => {
  test('counter shows remaining items', async ({ todoPage }) => {
    await todoPage.add('one', 'two', 'three');
    await expect(todoPage.count).toContainText('3 items left');
    await todoPage.toggleAt(0);
    await expect(todoPage.count).toContainText('2 items left');
  });

  test('active and completed filters work', async ({ todoPage }) => {
    await todoPage.add('keep', 'done');
    await todoPage.toggleAt(1);
    await todoPage.filter('Active');
    await expect(todoPage.titles).toHaveText(['keep']);
    await todoPage.filter('Completed');
    await expect(todoPage.titles).toHaveText(['done']);
  });

  test('todo can be deleted', async ({ todoPage }) => {
    await todoPage.add('temp');
    await todoPage.deleteFirst();
    await expect(todoPage.items).toHaveCount(0);
  });
});
