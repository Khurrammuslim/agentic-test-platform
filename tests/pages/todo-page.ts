import type { Locator, Page } from '@playwright/test';

export class TodoPage {
  readonly newTodo: Locator;
  readonly items: Locator;
  readonly titles: Locator;
  readonly count: Locator;

  constructor(private readonly page: Page) {
    this.newTodo = page.getByRole('textbox', { name: 'What needs to be done?' });
    this.items = page.getByTestId('todo-item');
    this.titles = page.getByTestId('todo-title');
    this.count = page.getByTestId('todo-count');
  }

  async goto() {
    await this.page.goto('./');
  }

  async add(...texts: string[]) {
    for (const text of texts) {
      await this.newTodo.fill(text);
      await this.newTodo.press('Enter');
    }
  }

  async toggleAt(index: number) {
    await this.items.nth(index).getByRole('checkbox').check();
  }

  async deleteFirst() {
    await this.items.first().hover();
    await this.items.first().getByRole('button', { name: 'Delete' }).click();
  }

  async filter(name: 'All' | 'Active' | 'Completed') {
    await this.page.getByRole('link', { name }).click();
  }
}
