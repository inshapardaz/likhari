import { test, expect } from '../support/fixtures';

test.describe('inline formatting', () => {
  test.beforeEach(async ({ editor }) => {
    await editor.open();
    await editor.type('Hello world');
    await editor.selectAll();
  });

  for (const [button, tag] of [
    ['Bold', 'strong'],
    ['Italic', 'em'],
    ['Underline', 'u'],
    ['Strikethrough', 's'],
  ] as const) {
    test(`${button} from the toolbar wraps the selection in <${tag}>`, async ({ editor }) => {
      await editor.button(button).click();

      await expect(editor.button(button)).toHaveAttribute('aria-pressed', 'true');
      expect(await editor.html()).toMatch(new RegExp(`<${tag}>Hello world</${tag}>`));
    });
  }

  test('keyboard shortcuts toggle bold and italic', async ({ editor, page }) => {
    await page.keyboard.press('ControlOrMeta+B');
    await page.keyboard.press('ControlOrMeta+I');
    const html = await editor.html();
    expect(html).toContain('<strong>');
    expect(html).toContain('<em>');
  });

  test('pressing a format again removes it', async ({ editor }) => {
    await editor.button('Bold').click();
    await editor.button('Bold').click();

    await expect(editor.button('Bold')).toHaveAttribute('aria-pressed', 'false');
    expect(await editor.html()).not.toContain('<strong>');
  });

  test('superscript and subscript live in the "More formatting" menu', async ({ editor }) => {
    await editor.menu('More formatting', 'Superscript');
    expect(await editor.html()).toContain('<sup>');
  });

  test('subscript is applied from the "More formatting" menu', async ({ editor }) => {
    await editor.menu('More formatting', 'Subscript');
    expect(await editor.html()).toContain('<sub>');
  });

  test('clear formatting removes every inline format', async ({ editor }) => {
    await editor.button('Bold').click();
    await editor.button('Italic').click();
    await editor.menu('More formatting', 'Clear formatting');

    const html = await editor.html();
    expect(html).not.toContain('<strong>');
    expect(html).not.toContain('<em>');
    expect(html).toContain('Hello world');
  });

  test('case transforms change the selected text', async ({ editor }) => {
    await editor.menu('More formatting', 'UPPERCASE');
    await expect(editor.content).toContainText('HELLO WORLD');

    await editor.menu('More formatting', 'lowercase');
    await expect(editor.content).toContainText('hello world');

    await editor.menu('More formatting', 'InitCap');
    await expect(editor.content).toContainText('Hello World');
  });
});

test.describe('block formatting', () => {
  test.beforeEach(async ({ editor }) => {
    await editor.open();
    await editor.type('A line of text');
  });

  for (const level of [1, 2, 3, 4, 5, 6]) {
    test(`Heading ${level} turns the paragraph into <h${level}>`, async ({ editor }) => {
      await editor.choose('Formatting', `Heading ${level}`);
      expect(await editor.html()).toMatch(new RegExp(`<h${level}[ >][^]*A line of text`));
    });
  }

  test('block dropdown reflects the block under the caret', async ({ editor }) => {
    await editor.choose('Formatting', 'Heading 2');
    await expect(editor.toolbar.getByRole('combobox', { name: 'Formatting', exact: true })).toHaveValue('Heading 2');

    await editor.choose('Formatting', 'Paragraph');
    await expect(editor.toolbar.getByRole('combobox', { name: 'Formatting', exact: true })).toHaveValue('Paragraph');
    expect(await editor.html()).not.toMatch(/<h\d/);
  });

  test('bullet list', async ({ editor }) => {
    await editor.choose('Formatting', 'Bullet list');
    expect(await editor.html()).toMatch(/<ul[^>]*>\s*<li[^>]*>A line of text/);
  });

  test('numbered list', async ({ editor }) => {
    await editor.choose('Formatting', 'Numbered list');
    expect(await editor.html()).toMatch(/<ol[^>]*>\s*<li[^>]*>A line of text/);
  });

  test('task list renders checkboxes that can be toggled', async ({ editor }) => {
    await editor.choose('Formatting', 'Task list');
    const item = editor.content.locator('li[role="checkbox"]');
    await expect(item).toHaveAttribute('aria-checked', 'false');
    await item.click({ position: { x: 2, y: 8 } });
    await expect(item).toHaveAttribute('aria-checked', 'true');
  });

  test('Enter continues a list and a second Enter leaves it', async ({ editor, page }) => {
    await editor.choose('Formatting', 'Bullet list');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await editor.type('Second');
    await expect(editor.content.locator('li')).toHaveCount(2);

    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(editor.content.locator('li')).toHaveCount(2);
    await editor.type('After');
    expect(await editor.html()).toMatch(/<\/ul>\s*<p[^>]*>After/);
  });

  test('quote', async ({ editor }) => {
    await editor.choose('Formatting', 'Quote');
    expect(await editor.html()).toMatch(/<blockquote[^>]*>A line of text/);
  });
});

test.describe('alignment and indentation', () => {
  test.beforeEach(async ({ editor }) => {
    await editor.open();
    await editor.type('Aligned text');
  });

  for (const [option, css] of [
    ['Align center', 'center'],
    ['Justify', 'justify'],
  ] as const) {
    test(`${option}`, async ({ editor }) => {
      await editor.choose('Alignment', option);
      expect(await editor.html()).toContain(`text-align: ${css}`);
    });
  }

  test('literal left and right alignment', async ({ editor }) => {
    await editor.choose('Alignment', 'Align right');
    expect(await editor.html()).toContain('text-align: right');
    await editor.choose('Alignment', 'Align left');
    expect(await editor.html()).toContain('text-align: left');
  });

  test('indent and outdent', async ({ editor }) => {
    await editor.button('Indent').click();
    expect(await editor.html()).toMatch(/padding-inline-start|margin-inline-start|text-indent/);

    await editor.button('Outdent').click();
    expect(await editor.html()).not.toMatch(/padding-inline-start: [1-9]|margin-inline-start: [1-9]/);
  });
});

test.describe('history', () => {
  test('undo and redo walk back and forward through edits', async ({ editor, page }) => {
    await editor.open();
    await editor.type('first');
    await page.waitForTimeout(400); // let the history group the typing as one step
    await editor.button('Bold').click();
    await editor.type(' second');

    await editor.button('Undo').click();
    await editor.button('Undo').click();
    await expect(editor.content).not.toContainText('second');

    await editor.button('Redo').click();
    await expect(editor.button('Redo')).toBeEnabled();
    await page.keyboard.press('ControlOrMeta+Shift+Z');
    await expect(editor.content).toContainText('second');
  });

  test('undo is disabled on a fresh document and redo after a new edit', async ({ editor }) => {
    await editor.open();
    await expect(editor.button('Redo')).toBeDisabled();
    await editor.type('x');
    await editor.button('Undo').click();
    await expect(editor.button('Redo')).toBeEnabled();
    await editor.type('y');
    await expect(editor.button('Redo')).toBeDisabled();
  });
});
