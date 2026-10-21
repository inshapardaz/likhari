import { test, expect, type EditorPage } from '../support/fixtures';

const lexicalDoc = (text: string) =>
  JSON.stringify({
    json: JSON.stringify({
      root: {
        type: 'root', version: 1, direction: 'ltr', format: '', indent: 0,
        children: [{ type: 'paragraph', version: 1, direction: 'ltr', format: '', indent: 0, textFormat: 0, textStyle: '',
          children: [{ type: 'text', version: 1, detail: 0, format: 0, mode: 'normal', style: '', text }] }],
      },
    }),
    savedAt: Date.now() - 60_000,
    version: 1,
    preview: text,
  });

const demo = (editor: EditorPage) => ({
  setting: (label: string) => editor.page.getByLabel(label, { exact: true }),
});

test.describe('explicit save', () => {
  test('Save is disabled until something changes, then hands over the content', async ({ editor, page }) => {
    await editor.open();
    await expect(editor.button('Save')).toBeDisabled();

    await editor.type('Final words');
    await expect(editor.button('Save')).toBeEnabled();
    await editor.button('Save').click();

    const dialog = page.getByRole('dialog', { name: /^Saved/ });
    await expect(dialog.locator('code')).toHaveText('Final words');
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(editor.button('Save')).toBeDisabled();
  });

  test('saving discards the autosaved draft', async ({ editor, page }) => {
    await editor.open();
    await editor.type('Will be saved');
    await expect.poll(() => editor.savedDraftText()).toBe('Will be saved');

    await editor.button('Save').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await expect.poll(() => editor.savedDraftText()).toBeNull();
  });

  test('the Save button can be hidden by the host', async ({ editor, page }) => {
    await editor.open();
    await demo(editor).setting('Save button').uncheck();
    await expect(editor.button('Save')).toHaveCount(0);
    void page;
  });
});

test.describe('autosaved drafts', () => {
  test('typing autosaves a draft in the browser', async ({ editor }) => {
    await editor.open();
    await editor.type('Work in progress');

    await expect.poll(() => editor.savedDraftText()).toBe('Work in progress');
  });

  test('after a reload the banner offers to restore the draft', async ({ editor, page }) => {
    await editor.open();
    await editor.type('Do not lose me');
    await expect.poll(() => editor.savedDraftText()).toBe('Do not lose me');

    await editor.reload();
    await expect(page.getByText(/An unsaved draft of this document from .* was found\./)).toBeVisible();
    await expect(editor.content).toHaveText('');

    await page.getByRole('button', { name: 'Restore' }).click();
    await expect(editor.content).toHaveText('Do not lose me');
    await expect(page.getByText(/An unsaved draft/)).toBeHidden();
  });

  test('Ignore dismisses the banner and leaves the editor empty', async ({ editor, page }) => {
    await editor.open();
    await editor.type('Ignore me');
    await expect.poll(() => editor.savedDraftText()).toBe('Ignore me');

    await editor.reload();
    await page.getByRole('button', { name: 'Ignore', exact: true }).click();
    await expect(page.getByText(/An unsaved draft/)).toBeHidden();
    await expect(editor.content).toHaveText('');
  });

  test('"Load a saved draft: Automatically" restores without asking', async ({ editor, page }) => {
    await editor.open();
    await editor.type('Auto restored');
    await expect.poll(() => editor.savedDraftText()).toBe('Auto restored');

    await page.getByLabel('Load a saved draft').selectOption('auto');
    await expect(editor.content).toHaveText('Auto restored');
    await expect(page.getByText(/An unsaved draft/)).toBeHidden();
  });

  test('"Load a saved draft: Never" ignores stored drafts', async ({ editor, page }) => {
    await editor.open();
    await editor.type('Not restored');
    await expect.poll(() => editor.savedDraftText()).toBe('Not restored');

    await page.getByLabel('Load a saved draft').selectOption('off');
    await expect(editor.content).toHaveText('');
    await expect(page.getByText(/An unsaved draft/)).toBeHidden();
  });

  test('autosave can be switched off', async ({ editor, page }) => {
    await editor.open();
    await demo(editor).setting('Save drafts (autosave)').uncheck();
    await editor.content.click();
    await editor.type('Not persisted');
    await page.waitForTimeout(1500);

    expect(await editor.savedDraftText()).toBeNull();
  });

  test('the Drafts dialog lists the current draft and drafts from other documents', async ({ editor, page }) => {
    await editor.seedStorage({ 'likhari:draft:other-doc': lexicalDoc('An older document') });
    await editor.open();
    await editor.type('Current words');
    await expect.poll(() => editor.savedDraftText()).toBe('Current words');

    await editor.button('Drafts').click();
    const dialog = page.getByRole('dialog', { name: 'Saved drafts' });
    const current = dialog.locator('[data-draft-id="demo-doc"]');
    await expect(current).toContainText('Current words');
    await expect(current).toContainText('Current document');
    await expect(dialog.locator('[data-draft-id="other-doc"]')).toContainText('An older document');
  });

  test('restoring a draft from the dialog asks first, then replaces the content', async ({ editor, page }) => {
    await editor.seedStorage({ 'likhari:draft:other-doc': lexicalDoc('From elsewhere') });
    await editor.open();
    await editor.type('Mine');
    await editor.button('Drafts').click();
    const dialog = page.getByRole('dialog', { name: 'Saved drafts' });
    const other = dialog.locator('[data-draft-id="other-doc"]');

    await other.getByRole('button', { name: 'Restore' }).click();
    await expect(other.getByText('Replace the current content with this draft?')).toBeVisible();
    await other.getByRole('button', { name: 'Replace' }).click();

    await expect(dialog).toBeHidden();
    await expect(editor.content).toHaveText('From elsewhere');
  });

  test('a draft can be deleted from the dialog after confirming', async ({ editor, page }) => {
    await editor.seedStorage({ 'likhari:draft:other-doc': lexicalDoc('Throw me away') });
    await editor.open();
    await editor.button('Drafts').click();
    const dialog = page.getByRole('dialog', { name: 'Saved drafts' });
    const other = dialog.locator('[data-draft-id="other-doc"]');

    await other.getByRole('button', { name: 'Delete' }).click();
    await expect(other.getByText('Delete this draft?')).toBeVisible();
    await other.getByRole('button', { name: 'Delete' }).click();

    await expect(other).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('likhari:draft:other-doc'))).toBeNull();
  });

  test('with no drafts the dialog says so', async ({ editor, page }) => {
    await editor.open();
    await editor.button('Drafts').click();
    await expect(page.getByRole('dialog', { name: 'Saved drafts' }).getByText('No drafts yet.')).toBeVisible();
  });
});

test.describe('leaving with unsaved changes', () => {
  const leave = (editor: EditorPage) => editor.page.getByRole('button', { name: 'Simulate leaving the page' });
  const result = (editor: EditorPage) => editor.page.getByRole('dialog', { name: 'confirmDiscard()' }).locator('code');

  test('a clean document can be left straight away', async ({ editor }) => {
    await editor.open();
    await leave(editor).click();
    await expect(result(editor)).toHaveText('true: it is fine to leave');
  });

  test('unsaved changes raise the Unsaved changes dialog; Cancel stays', async ({ editor, page }) => {
    await editor.open();
    await editor.type('Unsaved');
    await leave(editor).click();

    const dialog = page.getByRole('dialog', { name: 'Unsaved changes' });
    await expect(dialog.getByText('You have unsaved changes.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(result(editor)).toHaveText('false: stay on the page');
  });

  test('Discard allows leaving and throws the draft away', async ({ editor, page }) => {
    await editor.open();
    await editor.type('Unsaved');
    await expect.poll(() => editor.savedDraftText()).toBe('Unsaved');
    await leave(editor).click();
    await page.getByRole('dialog', { name: 'Unsaved changes' }).getByRole('button', { name: 'Discard' }).click();

    await expect(result(editor)).toHaveText('true: it is fine to leave');
    await expect.poll(() => editor.savedDraftText()).toBeNull();
  });

  test('Save draft allows leaving and keeps the draft', async ({ editor, page }) => {
    await editor.open();
    await editor.type('Keep this');
    await leave(editor).click();
    await page.getByRole('dialog', { name: 'Unsaved changes' }).getByRole('button', { name: 'Save draft' }).click();

    await expect(result(editor)).toHaveText('true: it is fine to leave');
    await expect.poll(() => editor.savedDraftText()).toBe('Keep this');
  });

  test('Save runs the host save, then allows leaving', async ({ editor, page }) => {
    await editor.open();
    await editor.type('Save me');
    await leave(editor).click();
    await page.getByRole('dialog', { name: 'Unsaved changes' }).getByRole('button', { name: 'Save', exact: true }).click();

    // The host's save ran (the document is clean again) and the leave was then allowed.
    await expect(result(editor)).toHaveText('true: it is fine to leave');
    await expect(editor.button('Save')).toBeDisabled();
  });

  test('"Don\'t ask" lets the user leave without a prompt', async ({ editor, page }) => {
    await editor.open();
    await page.getByLabel('When leaving unsaved').selectOption('off');
    await editor.content.click();
    await editor.type('Unsaved');
    await leave(editor).click();

    await expect(result(editor)).toHaveText('true: it is fine to leave');
    await expect(page.getByRole('dialog', { name: 'Unsaved changes' })).toHaveCount(0);
  });

  test('"Save a draft silently" keeps a draft and lets the user leave', async ({ editor, page }) => {
    await editor.open();
    await page.getByLabel('When leaving unsaved').selectOption('save-draft');
    await editor.content.click();
    await editor.type('Silent draft');
    await leave(editor).click();

    await expect(result(editor)).toHaveText('true: it is fine to leave');
    await expect.poll(() => editor.savedDraftText()).toBe('Silent draft');
  });
});

// mergePages(..., { joinParagraphs: 'blank-line' }) treats an empty paragraph at the end of a
// page as "the paragraph ends here", so saving must never trim it, in any format.
test.describe('a trailing empty paragraph', () => {
  const trailingEmpty = (html: string) => /<p[^>]*>Page text<\/p>\s*<p[^>]*><\/p>$/.test(html.trim());

  test.beforeEach(async ({ editor }) => {
    await editor.open();
    await editor.type('Page text');
    await editor.page.keyboard.press('Enter');
  });

  test('is kept in the HTML and Lexical JSON the editor gives back', async ({ editor }) => {
    expect(trailingEmpty(await editor.html())).toBe(true);

    const json = JSON.parse(await editor.output('Get Lexical JSON'));
    const blocks = json.root.children as { type: string; children: unknown[] }[];
    expect(blocks.map((b) => `${b.type}:${b.children.length}`)).toEqual(['paragraph:1', 'paragraph:0']);
  });

  test('is written to Markdown as ::blank, and is not there when the document has no empty ending', async ({ editor }) => {
    expect(await editor.output('Get Markdown')).toBe('Page text\n\n::blank\n');
    await editor.page.keyboard.press('Backspace');
    expect(await editor.output('Get Markdown')).toBe('Page text\n');
  });

  test('is kept by "Correct whole document" and its text cleanup', async ({ editor }) => {
    await editor.button('Correct whole document').click();
    expect(trailingEmpty(await editor.html())).toBe(true);
  });

  test('is kept in the autosaved draft and when it is restored', async ({ editor, page }) => {
    await expect.poll(() => editor.savedDraftText()).toBe('Page text');
    await editor.reload();
    await page.getByRole('button', { name: 'Restore' }).click();

    await expect(editor.content).toHaveText('Page text');
    expect(trailingEmpty(await editor.html())).toBe(true);
  });
});
