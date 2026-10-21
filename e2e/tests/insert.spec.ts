import { test, expect } from '../support/fixtures';
import { IMAGE_URL } from '../support/mocks';

test.describe('links', () => {
  test('Insert link dialog adds a link around the selected text', async ({ editor, page }) => {
    await editor.open();
    await editor.type('Visit our site');
    await page.keyboard.press('ControlOrMeta+A');
    await editor.button('Insert link (Ctrl+K)').click();

    const dialog = page.getByRole('dialog', { name: 'Insert link' });
    await dialog.getByRole('textbox', { name: 'URL' }).fill('https://example.com/page');
    await dialog.getByRole('button', { name: 'Apply' }).click();

    await expect(dialog).toBeHidden();
    await expect(editor.content.getByRole('link', { name: 'Visit our site' })).toHaveAttribute('href', 'https://example.com/page');
    expect(await editor.output('Get Markdown')).toContain('[Visit our site](https://example.com/page)');
  });

  test('Ctrl+K opens the dialog, and the Text field is used when nothing is selected', async ({ editor, page }) => {
    await editor.open();
    await page.keyboard.press('ControlOrMeta+K');

    const dialog = page.getByRole('dialog', { name: 'Insert link' });
    await dialog.getByRole('textbox', { name: 'URL' }).fill('https://example.com');
    await dialog.getByRole('textbox', { name: 'Text' }).fill('Example');
    await dialog.getByRole('button', { name: 'Apply' }).click();

    await expect(editor.content.getByRole('link', { name: 'Example' })).toBeVisible();
  });

  test('rejects an unsafe URL', async ({ editor, page }) => {
    await editor.open();
    await page.keyboard.press('ControlOrMeta+K');

    const dialog = page.getByRole('dialog', { name: 'Insert link' });
    await dialog.getByRole('textbox', { name: 'URL' }).fill('javascript:alert(1)');
    await dialog.getByRole('button', { name: 'Apply' }).click();

    await expect(dialog.getByText('Enter a valid http(s), mailto, tel or relative URL')).toBeVisible();
    await expect(editor.content.getByRole('link')).toHaveCount(0);
  });

  test('a domain without a scheme gets https://', async ({ editor, page }) => {
    await editor.open();
    await page.keyboard.press('ControlOrMeta+K');

    const dialog = page.getByRole('dialog', { name: 'Insert link' });
    await dialog.getByRole('textbox', { name: 'URL' }).fill('example.com/docs');
    await dialog.getByRole('textbox', { name: 'Text' }).fill('Docs');
    await dialog.getByRole('button', { name: 'Apply' }).click();

    await expect(editor.content.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', 'https://example.com/docs');
  });

  test('an existing link can be edited and removed from its menu', async ({ editor, page }) => {
    await editor.open();
    await page.getByRole('button', { name: 'Load HTML sample' }).click();
    await editor.content.getByRole('link', { name: 'link', exact: true }).click();
    await editor.button('Link options').click();
    await page.getByRole('menuitem', { name: 'Edit link' }).click();

    const dialog = page.getByRole('dialog', { name: 'Edit link' });
    await expect(dialog.getByRole('textbox', { name: 'URL' })).toHaveValue('https://example.com');
    await dialog.getByRole('textbox', { name: 'URL' }).fill('https://example.org');
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect(editor.content.getByRole('link', { name: 'link', exact: true })).toHaveAttribute('href', 'https://example.org');

    await editor.content.getByRole('link', { name: 'link', exact: true }).click();
    await editor.button('Link options').click();
    await page.getByRole('menuitem', { name: 'Remove link' }).click();
    await expect(editor.content.getByRole('link')).toHaveCount(0);
    await expect(editor.content).toContainText('and a link.');
  });

  test('pasting a bare URL over selected text links it', async ({ editor, page }) => {
    await editor.open();
    await editor.type('docs');
    await page.keyboard.press('ControlOrMeta+A');
    await editor.paste('https://example.com/guide');

    await expect(editor.content.getByRole('link', { name: 'docs' })).toHaveAttribute('href', 'https://example.com/guide');
  });
});

test.describe('block inserts', () => {
  test('horizontal rule', async ({ editor }) => {
    await editor.open();
    await editor.type('Above');
    await editor.button('Insert horizontal rule').click();
    await editor.type('Below');

    await expect(editor.content.locator('hr')).toHaveCount(1);
    expect(await editor.html()).toMatch(/Above<\/p>\s*<hr>\s*<p[^>]*>Below/);
    expect(await editor.output('Get Markdown')).toMatch(/Above\s+---\s+Below/);
  });

  test('page break shows its label and exports to Markdown and HTML', async ({ editor }) => {
    await editor.open();
    await editor.type('Page one');
    await editor.button('Insert page break').click();
    await editor.type('Page two');

    await expect(editor.content.getByText('Page break')).toBeVisible();
    expect(await editor.html()).toContain('data-likhari-page-break');
    expect(await editor.output('Get Markdown')).toContain('::pagebreak');
  });

  test('columns: choose a count, then type in each column', async ({ editor, page }) => {
    await editor.open();
    await editor.button('Insert columns').click();
    const dialog = page.getByRole('dialog', { name: 'Insert columns' });
    await dialog.getByRole('textbox', { name: 'Number of columns' }).fill('3');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    const columns = editor.content.locator('.likhari-layout-item');
    await expect(columns).toHaveCount(3);
    await editor.type('one');
    await columns.nth(1).click();
    await editor.type('two');
    await expect(columns.nth(0)).toContainText('one');
    await expect(columns.nth(1)).toContainText('two');
    expect(await editor.output('Get Markdown')).toContain('::::columns{count="3"}');
  });

  test('columns default to two', async ({ editor, page }) => {
    await editor.open();
    await editor.button('Insert columns').click();
    await page.getByRole('dialog', { name: 'Insert columns' }).getByRole('button', { name: 'Insert' }).click();
    expect(await editor.html()).toContain('repeat(2, 1fr)');
  });

  test('Cancel closes a dialog without inserting', async ({ editor, page }) => {
    await editor.open();
    await editor.button('Insert columns').click();
    await page.getByRole('dialog', { name: 'Insert columns' }).getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog')).toBeHidden();
    expect(await editor.html()).not.toContain('layout-container');
  });
});

test.describe('footnotes', () => {
  test('inserting a footnote adds a numbered reference and a note to type into', async ({ editor }) => {
    await editor.open();
    await editor.type('A claim');
    await editor.button('Insert footnote').click();
    await editor.type('The source');

    const html = await editor.html();
    expect(html).toMatch(/<sup data-likhari-footnote-ref="[^"]+"><a href="#fn-[^"]+"[^>]*>1<\/a><\/sup>/);
    expect(html).toContain('The source');
    expect(await editor.output('Get Markdown')).toMatch(/A claim\[\^[^\]]+\][^]*\[\^[^\]]+\]: The source/);
  });

  test('footnotes are numbered in document order', async ({ editor, page }) => {
    await editor.open();
    await editor.type('One');
    await editor.button('Insert footnote').click();
    await editor.type('first note');
    await editor.content.locator('p', { hasText: 'One' }).first().click();
    await page.keyboard.press('ControlOrMeta+End');
    await editor.button('Insert footnote').click();
    await editor.type('second note');

    // The number is drawn by CSS in the editor, so read it from the exported HTML.
    const html = await editor.html();
    const numbers = [...html.matchAll(/<sup data-likhari-footnote-ref="[^"]+"><a [^>]*>(\d+)<\/a><\/sup>/g)].map((m) => m[1]);
    expect(numbers).toEqual(['1', '2']);
  });
});

test.describe('known bugs', () => {
  // Inserting a block (rule, table, image ...) with the caret inside a footnote body inserts
  // nothing and adds a duplicate footnote item with the same id. `test.fail` keeps the suite
  // green while that is open and turns red once it is fixed, as a prompt to drop this wrapper.
  test.fail('a block insert with the caret in a footnote does not duplicate the footnote', async ({ editor }) => {
    await editor.open();
    await editor.type('Claim');
    await editor.button('Insert footnote').click();
    await editor.type('note');
    await editor.button('Insert horizontal rule').click();

    const items = (await editor.html()).match(/data-likhari-footnote-item=/g) ?? [];
    expect(items).toHaveLength(1);
  });
});

test.describe('tables', () => {
  async function insertTable(editor: import('../support/fixtures').EditorPage, rows = 3, columns = 3) {
    await editor.button('Insert table').click();
    const dialog = editor.page.getByRole('dialog', { name: 'Insert table' });
    await dialog.getByRole('textbox', { name: 'Rows' }).fill(String(rows));
    await dialog.getByRole('textbox', { name: 'Columns' }).fill(String(columns));
    await dialog.getByRole('button', { name: 'Insert' }).click();
  }

  test('inserts a table with a header row of the chosen size', async ({ editor }) => {
    await editor.open();
    await insertTable(editor, 3, 4);

    await expect(editor.content.locator('table')).toHaveCount(1);
    await expect(editor.content.locator('tr')).toHaveCount(3);
    await expect(editor.content.locator('tr').first().locator('th')).toHaveCount(4);
  });

  test('without a header row every cell is a data cell', async ({ editor, page }) => {
    await editor.open();
    await editor.button('Insert table').click();
    const dialog = page.getByRole('dialog', { name: 'Insert table' });
    await dialog.getByRole('checkbox', { name: 'Header row' }).uncheck();
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await expect(editor.content.locator('table')).toHaveCount(1);
    await expect(editor.content.locator('th')).toHaveCount(0);
  });

  test('typing and Tab move through cells, and the table exports to Markdown', async ({ editor, page }) => {
    await editor.open();
    await insertTable(editor, 2, 2);
    await editor.type('A');
    await page.keyboard.press('Tab');
    await editor.type('B');
    await page.keyboard.press('Tab');
    await editor.type('1');
    await page.keyboard.press('Tab');
    await editor.type('2');

    const markdown = await editor.output('Get Markdown');
    expect(markdown).toMatch(/\|\s*A\s*\|\s*B\s*\|/);
    expect(markdown).toMatch(/\|\s*1\s*\|\s*2\s*\|/);
  });

  test('the table menu adds and removes rows and columns', async ({ editor, page }) => {
    await editor.open();
    await insertTable(editor, 2, 2);
    await editor.type('x');

    await editor.menu('Table options', 'Insert row after');
    await expect(editor.content.locator('tr')).toHaveCount(3);
    await editor.menu('Table options', 'Insert column after');
    await expect(editor.content.locator('tr').first().locator('th, td')).toHaveCount(3);
    await editor.menu('Table options', 'Delete row');
    await expect(editor.content.locator('tr')).toHaveCount(2);
    await editor.menu('Table options', 'Delete column');
    await expect(editor.content.locator('tr').first().locator('th, td')).toHaveCount(2);
    await editor.menu('Table options', 'Delete table');
    await expect(editor.content.locator('table')).toHaveCount(0);
    void page;
  });

  test('right-clicking a cell opens the same table menu', async ({ editor, page }) => {
    await editor.open();
    await insertTable(editor, 2, 2);
    await editor.content.locator('td').first().click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Insert row after' })).toBeVisible();
  });
});

test.describe('images', () => {
  test('inserts an image from a URL with alt text and a caption', async ({ editor, page }) => {
    await editor.open();
    await editor.button('Insert image').click();
    const dialog = page.getByRole('dialog', { name: 'Insert image' });
    await dialog.getByRole('textbox', { name: 'Image URL' }).fill(IMAGE_URL);
    await dialog.getByRole('textbox', { name: 'Alt text' }).fill('A photo');
    await dialog.getByRole('textbox', { name: 'Caption' }).fill('My caption');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await expect(editor.content.getByRole('img', { name: 'A photo' })).toHaveAttribute('src', IMAGE_URL);
    await expect(editor.content).toContainText('My caption');
    // A captioned image uses the figure directive; a plain one is ![alt](src).
    expect(await editor.output('Get Markdown')).toContain(`::figure[My caption]{src="${IMAGE_URL}" alt="A photo"}`);
  });

  test('requires an image URL', async ({ editor, page }) => {
    await editor.open();
    await editor.button('Insert image').click();
    const dialog = page.getByRole('dialog', { name: 'Insert image' });
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await expect(dialog.getByText('Enter an http(s) or relative image URL')).toBeVisible();
    await expect(editor.content.getByRole('img')).toHaveCount(0);
  });

  test('uploading a file embeds it in the document', async ({ editor, page }) => {
    await editor.open();
    await editor.button('Insert image').click();
    const dialog = page.getByRole('dialog', { name: 'Insert image' });
    await dialog.getByText('Upload', { exact: true }).click();
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'dot.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
    });
    await dialog.getByRole('textbox', { name: 'Alt text' }).fill('Embedded dot');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await expect(editor.content.getByRole('img', { name: 'Embedded dot' })).toHaveAttribute('src', /^data:image\/png;base64,/);
  });

  test('embedding a copy of a linked image downloads it through the (mocked) network', async ({ editor, page, network }) => {
    await editor.open();
    await editor.button('Insert image').click();
    const dialog = page.getByRole('dialog', { name: 'Insert image' });
    await dialog.getByRole('textbox', { name: 'Image URL' }).fill(IMAGE_URL);
    await dialog.getByRole('checkbox', { name: 'Embed a copy in the document' }).check();
    await dialog.getByRole('textbox', { name: 'Alt text' }).fill('Copy');
    await dialog.getByRole('button', { name: 'Insert' }).click();

    await expect(editor.content.getByRole('img', { name: 'Copy' })).toHaveAttribute('src', /^data:image\/png/);
    expect(network.mocked.some((r) => r.includes('images.example.test'))).toBe(true);
  });
});
