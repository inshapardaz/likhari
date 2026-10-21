import { test, expect } from '../support/fixtures';

test.describe('editor shell', () => {
  test('loads the whole editor with a toolbar, a placeholder and no errors', async ({ editor, page }) => {
    await editor.open();

    await expect(editor.toolbar).toBeVisible();
    await expect(editor.content).toBeEditable();
    await expect(page.getByText('Start writing…')).toBeVisible();
    await expect(editor.button('Bold')).toBeVisible();
    await expect(editor.button('Insert table')).toBeVisible();
  });

  test('typing replaces the placeholder', async ({ editor, page }) => {
    await editor.open();
    await editor.type('Hello world');

    await expect(editor.content).toContainText('Hello world');
    await expect(page.getByText('Start writing…')).toBeHidden();
  });

  test('exports an empty editor as empty plain text', async ({ editor }) => {
    await editor.open();
    expect((await editor.output('Get plain text')).trim()).toBe('');
  });

  test('does not touch the real network: fonts, dictionaries and WordNet are all mocked', async ({ editor, network }) => {
    await editor.open();
    await editor.type('hello');
    await editor.button('Spell-checker').click();

    expect(network.unmocked).toEqual([]);
  });
});
