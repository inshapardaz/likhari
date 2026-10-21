import { test, expect } from '../support/fixtures';

test.describe('importing', () => {
  test('HTML sample becomes headings, inline formats, links, RTL paragraphs and lists', async ({ editor, page }) => {
    await editor.open();
    await page.getByRole('button', { name: 'Load HTML sample' }).click();

    await expect(editor.content.getByRole('heading', { level: 1, name: 'Imported from HTML' })).toBeVisible();
    await expect(editor.content.locator('strong', { hasText: 'bold' })).toBeVisible();
    await expect(editor.content.locator('em', { hasText: 'italic' })).toBeVisible();
    await expect(editor.content.getByRole('link', { name: 'link' })).toHaveAttribute('href', 'https://example.com');
    await expect(editor.content.locator('p[dir="rtl"]')).toContainText('یہ اردو کا ایک پیراگراف ہے۔');
    await expect(editor.content.locator('ul > li')).toHaveText(['One', 'Two']);
  });

  test('Markdown sample becomes headings, underline, centred RTL text, a task list and a table', async ({ editor, page }) => {
    await editor.open();
    await page.getByRole('button', { name: 'Load Markdown sample' }).click();

    await expect(editor.content.getByRole('heading', { level: 1, name: 'Imported from Markdown' })).toBeVisible();
    expect(await editor.html()).toContain('<u>underlined</u>');
    await expect(editor.content.locator('p[dir="rtl"]')).toHaveCSS('text-align', 'center');
    await expect(editor.content.locator('li[role="checkbox"]')).toHaveCount(2);
    await expect(editor.content.locator('li[role="checkbox"]').first()).toHaveAttribute('aria-checked', 'true');
    await expect(editor.content.locator('table')).toHaveCount(1);
    await expect(editor.content.locator('th')).toHaveText(['A', 'B']);
    await expect(editor.content.locator('td')).toHaveText(['1', '2']);
  });

  test('loading content replaces what was there', async ({ editor, page }) => {
    await editor.open();
    await editor.type('old text');
    await page.getByRole('button', { name: 'Load HTML sample' }).click();

    await expect(editor.content).not.toContainText('old text');
  });

  test('pasting HTML keeps its structure and drops unsafe markup', async ({ editor }) => {
    await editor.open();
    await editor.content.evaluate((el) => {
      const data = new DataTransfer();
      data.setData('text/html', '<h2>Pasted</h2><p>safe <b>bold</b><script>window.__pwned = true</script></p>');
      data.setData('text/plain', 'Pasted safe bold');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });

    await expect(editor.content.getByRole('heading', { level: 2, name: 'Pasted' })).toBeVisible();
    await expect(editor.content.locator('strong, b')).toHaveText('bold');
    expect(await editor.page.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned)).toBeUndefined();
  });
});

test.describe('exporting', () => {
  test('writes the same document as plain text, HTML, Markdown and Lexical JSON', async ({ editor, page }) => {
    await editor.open();
    await page.getByRole('button', { name: 'Load HTML sample' }).click();

    expect(await editor.output('Get plain text')).toBe(
      'Imported from HTML\n\nPlain, bold, italic and a link.\n\nیہ اردو کا ایک پیراگراف ہے۔\n\n- One\n- Two',
    );
    expect(await editor.output('Get HTML')).toContain('<a href="https://example.com">link</a>');
    expect(await editor.output('Get Markdown')).toContain('Plain, **bold**, *italic* and a [link](https://example.com).');

    const json = JSON.parse(await editor.output('Get Lexical JSON'));
    expect(json.root.type).toBe('root');
    expect(JSON.stringify(json)).toContain('Imported from HTML');
  });

  test('Markdown keeps alignment and direction of RTL paragraphs through the dialect', async ({ editor, page }) => {
    await editor.open();
    await page.getByRole('button', { name: 'Load Markdown sample' }).click();

    const markdown = await editor.output('Get Markdown');
    expect(markdown).toContain(':::para{align="center"}\nسلام دنیا\n:::');
    expect(markdown).toContain(':u[underlined]');
    expect(markdown).toContain('- [x] done\n- [ ] todo');
    expect(markdown).toMatch(/\| A \| B \|\n\| - \| - \|\n\| 1 \| 2 \|/);
  });

  test('a document survives a Markdown round trip through typing and formatting', async ({ editor }) => {
    await editor.open();
    await editor.choose('Formatting', 'Heading 2');
    await editor.type('Title');
    await editor.page.keyboard.press('Enter');
    await editor.type('plain ');
    await editor.button('Bold').click();
    await editor.type('strong');

    const markdown = await editor.output('Get Markdown');
    expect(markdown).toContain('## Title');
    expect(markdown).toContain('plain **strong**');
  });

  test('exporting never changes the document', async ({ editor }) => {
    await editor.open();
    await editor.type('stay put');
    const before = await editor.output('Get Lexical JSON');
    await editor.output('Get HTML');
    await editor.output('Get Markdown');
    expect(await editor.output('Get Lexical JSON')).toBe(before);
  });
});
