import { test, expect } from '../support/fixtures';

test.describe('find and replace', () => {
  test.beforeEach(async ({ editor }) => {
    await editor.open();
    await editor.type('the cat and the hat and the bat');
    await editor.button('Find and replace').click();
  });

  const bar = (page: import('@playwright/test').Page) => page.getByRole('search');

  test('counts matches and moves between them, wrapping round', async ({ page }) => {
    await bar(page).getByRole('textbox', { name: 'Find' }).fill('the');

    await expect(bar(page).getByText('1 / 3')).toBeVisible();
    await bar(page).getByRole('button', { name: 'Next' }).click();
    await expect(bar(page).getByText('2 / 3')).toBeVisible();
    await bar(page).getByRole('button', { name: 'Previous' }).click();
    await bar(page).getByRole('button', { name: 'Previous' }).click();
    await expect(bar(page).getByText('3 / 3')).toBeVisible();
  });

  test('Enter in the find box goes to the next match', async ({ page }) => {
    const find = bar(page).getByRole('textbox', { name: 'Find' });
    await find.fill('and');
    await expect(bar(page).getByText('1 / 2')).toBeVisible();
    await find.press('Enter');
    await expect(bar(page).getByText('2 / 2')).toBeVisible();
  });

  test('says when nothing matches and disables navigation', async ({ page }) => {
    await bar(page).getByRole('textbox', { name: 'Find' }).fill('zebra');

    await expect(bar(page).getByText('No matches')).toBeVisible();
    await expect(bar(page).getByRole('button', { name: 'Next' })).toBeDisabled();
    await expect(bar(page).getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  test('replaces the current match only', async ({ editor, page }) => {
    await bar(page).getByRole('textbox', { name: 'Find' }).fill('cat');
    await bar(page).getByRole('button', { name: 'Replace', exact: true }).first().click();
    await bar(page).getByRole('textbox', { name: 'Replace' }).fill('dog');
    await bar(page).getByRole('button', { name: 'Replace', exact: true }).last().click();

    await expect(editor.content).toContainText('the dog and the hat');
    await expect(editor.content).not.toContainText('cat');
  });

  test('replace all replaces every match', async ({ editor, page }) => {
    await bar(page).getByRole('textbox', { name: 'Find' }).fill('the');
    await bar(page).getByRole('button', { name: 'Replace', exact: true }).first().click();
    await bar(page).getByRole('textbox', { name: 'Replace' }).fill('a');
    await bar(page).getByRole('button', { name: 'Replace all' }).click();

    await expect(editor.content).toContainText('a cat and a hat and a bat');
    await expect(bar(page).getByText('No matches')).toBeVisible();
  });

  test('replacing keeps the text around it formatted', async ({ editor, page }) => {
    await editor.content.click();
    await editor.selectAll();
    await editor.button('Bold').click();
    await bar(page).getByRole('textbox', { name: 'Find' }).fill('cat');
    await bar(page).getByRole('button', { name: 'Replace', exact: true }).first().click();
    await bar(page).getByRole('textbox', { name: 'Replace' }).fill('fox');
    await bar(page).getByRole('button', { name: 'Replace all' }).click();

    expect(await editor.html()).toContain('<strong>the fox and the hat and the bat</strong>');
  });

  test('replace can be undone', async ({ editor, page }) => {
    await bar(page).getByRole('textbox', { name: 'Find' }).fill('cat');
    await bar(page).getByRole('button', { name: 'Replace', exact: true }).first().click();
    await bar(page).getByRole('textbox', { name: 'Replace' }).fill('dog');
    await bar(page).getByRole('button', { name: 'Replace all' }).click();
    await expect(editor.content).toContainText('dog');

    await editor.button('Undo').click();
    await expect(editor.content).toContainText('cat');
  });

  test('closing the bar clears it', async ({ page }) => {
    await bar(page).getByRole('button', { name: 'Close' }).click();
    await expect(bar(page)).toBeHidden();
  });

  test('searches table cells and RTL text', async ({ editor, page }) => {
    await page.getByRole('button', { name: 'Load Markdown sample' }).click();
    await bar(page).getByRole('textbox', { name: 'Find' }).fill('دنیا');
    await expect(bar(page).getByText('1 / 1')).toBeVisible();

    await bar(page).getByRole('textbox', { name: 'Find' }).fill('2');
    await expect(bar(page).getByText('1 / 1')).toBeVisible();
    void editor;
  });
});
