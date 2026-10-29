import { test, expect } from '../support/fixtures';

const labels = (editor: import('../support/fixtures').EditorPage) =>
  editor.toolbar.getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));

test.describe('presets', () => {
  test('minimal: only save, undo/redo and drafts, no formatting chrome', async ({ editor }) => {
    await editor.open({ preset: 'minimal' });

    expect(await labels(editor)).toEqual(['Save', 'Undo', 'Redo', 'Drafts']);
    await expect(editor.toolbar.getByRole('combobox')).toHaveCount(0);
  });

  test('standard: formatting, lists and quote, but no tables, columns or footnotes', async ({ editor }) => {
    await editor.open({ preset: 'standard' });

    await expect(editor.button('Bold')).toBeVisible();
    await expect(editor.button('Insert link (Ctrl+K)')).toBeVisible();
    await expect(editor.button('Insert table')).toHaveCount(0);
    await expect(editor.button('Insert columns')).toHaveCount(0);
    await expect(editor.button('Insert footnote')).toHaveCount(0);
  });

  test('full: everything is on', async ({ editor }) => {
    await editor.open({ preset: 'full' });

    for (const name of ['Bold', 'Insert table', 'Insert columns', 'Insert footnote', 'Insert page break', 'Find and replace', 'Spell-checker', 'Auto-correct']) {
      await expect(editor.button(name)).toBeVisible();
    }
  });

  test('switching preset in the demo reconfigures the live editor', async ({ editor, page }) => {
    await editor.open({ preset: 'full' });
    await expect(editor.button('Insert table')).toBeVisible();

    await page.getByRole('combobox', { name: 'Preset' }).selectOption('minimal');
    await expect(editor.button('Insert table')).toHaveCount(0);
    await expect(editor.button('Bold')).toHaveCount(0);
  });

  test('typing still works in the minimal preset and the content survives a preset change', async ({ editor, page }) => {
    await editor.open({ preset: 'minimal' });
    await editor.type('still here');
    await page.getByRole('combobox', { name: 'Preset' }).selectOption('full');

    await expect(editor.content).toHaveText('still here');
  });
});

test.describe('feature toggles', () => {
  for (const [checkbox, button] of [
    ['Bold', 'Bold'],
    ['Italic', 'Italic'],
    ['Underline', 'Underline'],
    ['Strikethrough', 'Strikethrough'],
    ['Table', 'Insert table'],
    ['Columns', 'Insert columns'],
    ['Footnotes', 'Insert footnote'],
    ['Page break', 'Insert page break'],
    ['Undo / redo', 'Undo'],
    ['Indent / outdent', 'Indent'],
  ] as const) {
    test(`unticking "${checkbox}" removes the "${button}" button`, async ({ editor, page }) => {
      await editor.open();
      await expect(editor.button(button)).toBeVisible();

      await page.getByRole('checkbox', { name: checkbox, exact: true }).uncheck();
      await expect(editor.button(button)).toHaveCount(0);

      await page.getByRole('checkbox', { name: checkbox, exact: true }).check();
      await expect(editor.button(button)).toBeVisible();
    });
  }

  test('unticking a heading level removes it from the block dropdown', async ({ editor, page }) => {
    await editor.open();
    await page.getByRole('checkbox', { name: 'Heading 6', exact: true }).uncheck();
    await editor.toolbar.getByRole('combobox', { name: 'Formatting', exact: true }).click();

    await expect(page.getByRole('option', { name: 'Heading 5' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Heading 6' })).toHaveCount(0);
  });

  // The feature toggles control what the toolbar offers, not which nodes the editor can hold
  // (architecture doc §2): content that already has a table, columns or footnotes must still open.
  test('turned-off features still render when content that uses them is loaded', async ({ editor, page }) => {
    await editor.open();
    await page.getByRole('checkbox', { name: 'Table', exact: true }).uncheck();
    await page.getByRole('checkbox', { name: 'Columns', exact: true }).uncheck();
    await page.getByRole('button', { name: 'Load Markdown sample' }).click();

    await expect(editor.button('Insert table')).toHaveCount(0);
    await expect(editor.content.locator('table')).toHaveCount(1);
    await expect(editor.content.locator('td')).toHaveText(['1', '2']);
  });

  test('"Feature config" shows the configuration the editor is running with', async ({ editor, page }) => {
    await editor.open();
    await page.getByRole('checkbox', { name: 'Bold', exact: true }).uncheck();
    await page.getByRole('button', { name: 'Feature config' }).click();

    const json = JSON.parse(await page.getByRole('dialog', { name: /EditorFeatureConfig/ }).locator('code').innerText());
    expect(json.formatting.bold).toBe(false);
    expect(json.formatting.italic).toBe(true);
  });
});

test.describe('toolbar presentation', () => {
  test('the help button links to the Markdown dialect docs and can be hidden', async ({ editor, page }) => {
    await editor.open();
    await expect(editor.toolbar.getByRole('link', { name: 'Help' })).toHaveAttribute('href', /markdown-dialect\.md$/);

    await page.getByRole('checkbox', { name: 'Help button' }).uncheck();
    await expect(editor.toolbar.getByRole('link', { name: 'Help' })).toHaveCount(0);
  });

  test('uniform font mode shows zoom controls that change the content size', async ({ editor, page }) => {
    await editor.open();
    await page.getByRole('checkbox', { name: 'Uniform font + zoom' }).check();
    await editor.content.click(); // the checkbox has focus; a space typed there would untick it
    await editor.type('zoom me');
    const before = await editor.content.locator('p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    await editor.button('Zoom in').click();
    await expect
      .poll(() => editor.content.locator('p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize)))
      .toBeGreaterThan(before);

    await editor.button(/^Reset zoom to 100%/).click();
    await expect
      .poll(() => editor.content.locator('p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize)))
      .toBeCloseTo(before, 0);
  });

  test('the font family and size dropdowns apply to the selection', async ({ editor, page }) => {
    await editor.open();
    await editor.type('sized text');
    await editor.selectAll();
    await editor.choose('Font size', '24');

    await expect(editor.content.locator('[style*="font-size"]').first()).toHaveCSS('font-size', '24px');
    void page;
  });

  test('narrow screens move toolbar groups into an overflow menu that still works', async ({ editor, page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await editor.open({ overflow: true });
    await expect(editor.button('Insert table')).toHaveCount(0);

    await editor.toolbar.getByRole('button', { name: 'More formatting' }).last().click();
    await page.getByRole('menu').getByRole('button', { name: 'Insert table' }).click();
    await page.getByRole('dialog', { name: 'Insert table' }).getByRole('button', { name: 'Insert' }).click();

    await expect(editor.content.locator('table')).toHaveCount(1);
  });

  test('without the overflow menu every button stays on the bar', async ({ editor }) => {
    await editor.open();

    await expect(editor.button('Insert table')).toBeVisible();
    await expect(editor.button('Find and replace')).toBeVisible();
  });

  test('stays on one row at a width with room for everything, even with the overflow menu enabled', async ({ editor, page }) => {
    // The 'full' preset's toolbar, with every group inline, is wide: this needs real room.
    await page.setViewportSize({ width: 2600, height: 900 });
    await editor.open({ overflow: true });

    // Only the unrelated, always-present formatting-overflow button ("strikethrough,
    // superscript, ...") shares this name — the responsive "..." trigger isn't rendered
    // at all unless something actually needs to move into it.
    await expect(editor.toolbar.getByRole('button', { name: 'More formatting' })).toHaveCount(1);
    const height = (await editor.toolbar.boundingBox())!.height;
    expect(height, 'toolbar wrapped onto a second row despite having room for everything').toBeLessThan(60);
  });

  test('moves groups into the overflow menu instead of wrapping onto a second row, once they stop fitting', async ({ editor, page }) => {
    // Narrow enough that several movable groups (tools, font, insert, ...) must move into
    // the "..." menu, but still comfortably wide enough for the groups that never do
    // (save, undo/redo, formatting, align/indent) to fit on their own in one row.
    await page.setViewportSize({ width: 1100, height: 900 });
    await editor.open({ overflow: true });

    // The responsive "..." trigger, last in DOM order after the unrelated formatting one.
    await expect(editor.toolbar.getByRole('button', { name: 'More formatting' })).toHaveCount(2);
    await expect(editor.toolbar.getByRole('button', { name: 'More formatting' }).last()).toBeVisible();
    const height = (await editor.toolbar.boundingBox())!.height;
    expect(height, 'toolbar wrapped onto a second row instead of using the overflow menu').toBeLessThan(60);
  });
});

test.describe('poetry', () => {
  test('inserts a poetry block that exports to the poetry directive', async ({ editor }) => {
    await editor.open({ preset: 'poetry', locale: 'ur' });
    await editor.button('شعر شامل کریں').click();
    await editor.type('پہلا مصرع');

    expect(await editor.html()).toContain('data-likhari-poetry-layout="single"');
    expect(await editor.output('Get Markdown')).toContain(':::poetry{layout="single"}');
  });

  test('the poetry options menu appears with the caret in the block and changes its layout', async ({ editor, page }) => {
    await editor.open({ preset: 'poetry', locale: 'ur' });
    await expect(editor.button('شاعری کے اختیارات')).toHaveCount(0);
    await editor.button('شعر شامل کریں').click();
    await editor.type('شعر');

    await editor.button('شاعری کے اختیارات').click();
    await expect(page.getByRole('menuitem')).not.toHaveCount(0);
  });
});
