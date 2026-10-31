import type { Page } from '@playwright/test';
import { test, expect, type EditorPage } from '../support/fixtures';

const ribbon = (page: Page) => page.locator('.likhari-ribbon');
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const cmd = (page: Page, name: string | RegExp) => ribbon(page).getByRole('button', { name });
const panel = (page: Page) => page.getByRole('toolbar', { name: 'Formatting' });
const tabNames = (page: Page) => page.getByRole('tab').allInnerTexts();
const quick = (page: Page) => page.getByRole('toolbar', { name: 'Quick access' });
const utilities = (page: Page) => page.getByRole('toolbar', { name: 'Document tools' });

async function openRibbon(editor: EditorPage, prefs: Parameters<EditorPage['open']>[0] = {}) {
  await editor.open({ ribbon: true, ...prefs });
}

test.describe('the layout is opt-in', () => {
  test('the classic single row is still the default', async ({ editor, page }) => {
    await editor.open();
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await expect(editor.toolbar.getByRole('button', { name: 'Bold' })).toBeVisible();
  });

  test('the demo switch turns the ribbon on and off without losing the content', async ({ editor, page }) => {
    await editor.open();
    await editor.type('keep me');
    await page.getByRole('checkbox', { name: 'Ribbon layout' }).check();
    await expect(page.getByRole('tablist', { name: 'Ribbon tabs' })).toBeVisible();

    await page.getByRole('checkbox', { name: 'Ribbon layout' }).uncheck();
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await expect(editor.content).toHaveText('keep me');
  });

  test('the choice is remembered across reloads', async ({ editor, page }) => {
    await editor.open();
    await page.getByRole('checkbox', { name: 'Ribbon layout' }).check();
    await editor.reload();
    await expect(page.getByRole('tablist', { name: 'Ribbon tabs' })).toBeVisible();
  });
});

test.describe('tabs and their commands', () => {
  test('a full editor has Home, Insert and Tools, and no context tabs yet', async ({ editor, page }) => {
    await openRibbon(editor);
    expect(await tabNames(page)).toEqual(['Home', 'Insert', 'Tools']);
  });

  test('Home holds text formatting, alignment, indent and font, and starts selected', async ({ editor, page }) => {
    await openRibbon(editor);
    await expect(tab(page, 'Home')).toHaveAttribute('aria-selected', 'true');

    for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough', 'More formatting', 'Outdent', 'Indent']) {
      await expect(cmd(page, name).first()).toBeVisible();
    }
    for (const name of ['Formatting', 'Alignment', 'Font family', 'Font size']) {
      await expect(panel(page).getByRole('combobox', { name, exact: true })).toBeVisible();
    }
    await expect(cmd(page, 'Insert table')).toHaveCount(0);
  });

  test('Insert holds what goes into the document', async ({ editor, page }) => {
    await openRibbon(editor);
    await tab(page, 'Insert').click();

    for (const name of ['Insert link (Ctrl+K)', 'Insert image', 'Insert horizontal rule', 'Insert table', 'Insert columns', 'Insert footnote', 'Insert page break']) {
      await expect(cmd(page, name)).toBeVisible();
    }
    await expect(cmd(page, 'Bold')).toHaveCount(0);
  });

  test('Tools holds the language tools, but not find and replace', async ({ editor, page }) => {
    await openRibbon(editor);
    // Join lines only shows once the selection actually spans more than one line.
    await editor.type('first');
    await page.keyboard.press('Enter');
    await editor.type('second');
    await editor.selectAll();
    await tab(page, 'Tools').click();

    for (const name of ['Auto-correct', 'Correct whole document', 'Spell-checker', 'Join lines']) {
      await expect(panel(page).getByRole('button', { name })).toBeVisible();
    }
    await expect(panel(page).getByRole('button', { name: 'Find and replace' })).toHaveCount(0);
  });

  test('there is no View tab: zoom is on the tab row, not on a tab', async ({ editor, page }) => {
    await openRibbon(editor);
    await expect(tab(page, 'View')).toHaveCount(0);
    await expect(utilities(page).getByRole('button', { name: 'Zoom in' })).toHaveCount(0); // only in uniform font mode

    await page.getByRole('checkbox', { name: 'Uniform font + zoom' }).check();
    await expect(tab(page, 'View')).toHaveCount(0);
    expect(await tabNames(page)).toEqual(['Home', 'Insert', 'Tools']);
    for (const name of ['Zoom out', /^Reset zoom to 100%/, 'Zoom in']) await expect(utilities(page).getByRole('button', { name })).toBeVisible();
  });

  test('a command on each tab does its job', async ({ editor, page }) => {
    await openRibbon(editor);
    await editor.type('word');
    await editor.selectAll();
    await cmd(page, 'Bold').click();
    expect(await editor.html()).toContain('<strong>word</strong>');

    await tab(page, 'Insert').click();
    await cmd(page, 'Insert horizontal rule').click();
    await expect(editor.content.locator('hr')).toHaveCount(1);

    // Join lines only shows once the selection actually spans more than one line.
    await page.keyboard.press('Enter');
    await editor.type('second line');
    await editor.selectAll();

    await tab(page, 'Tools').click();
    await expect(cmd(page, 'Join lines')).toBeVisible();
    await expect(cmd(page, 'Spell-checker')).toBeVisible();
  });

  test('Insert → Insert table opens the table dialog and inserts a table', async ({ editor, page }) => {
    await openRibbon(editor);
    await tab(page, 'Insert').click();
    await cmd(page, 'Insert table').click();
    await page.getByRole('dialog', { name: 'Insert table' }).getByRole('button', { name: 'Insert' }).click();

    await expect(editor.content.locator('table')).toHaveCount(1);
  });

  test('Save, undo and redo stay in reach on every tab', async ({ editor, page }) => {
    await openRibbon(editor);
    await editor.type('first');
    await editor.page.waitForTimeout(300);

    for (const name of ['Home', 'Insert', 'Tools']) {
      await tab(page, name).click();
      for (const button of ['Save', 'Undo', 'Redo']) await expect(quick(page).getByRole('button', { name: button })).toBeVisible();
    }
    await quick(page).getByRole('button', { name: 'Undo' }).click();
    await expect(editor.content).not.toContainText('first');
    await expect(quick(page).getByRole('button', { name: 'Redo' })).toBeEnabled();
  });

  test('the right-click menu and the dialogs still work', async ({ editor, page }) => {
    await openRibbon(editor);
    await editor.type('hello');
    await editor.content.getByText('hello').click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Select all' })).toBeVisible();
    await page.keyboard.press('Escape');

    await tab(page, 'Insert').click();
    await cmd(page, 'Insert link (Ctrl+K)').click();
    await expect(page.getByRole('dialog', { name: 'Insert link' })).toBeVisible();
  });
});

test.describe('clicking a tab does not take the caret out of the editor', () => {
  test('typing carries on after switching tabs', async ({ editor, page }) => {
    await openRibbon(editor);
    await editor.type('abc');
    await tab(page, 'Insert').click();
    await tab(page, 'Home').click();
    await editor.type('def');

    await expect(editor.content).toHaveText('abcdef');
  });

  test('the selection survives, so a command on another tab acts on it', async ({ editor, page }) => {
    await openRibbon(editor);
    await editor.type('make me bold');
    await editor.selectAll();
    await tab(page, 'Tools').click();
    await tab(page, 'Home').click();
    await cmd(page, 'Bold').click();

    expect(await editor.html()).toContain('<strong>make me bold</strong>');
  });
});

test.describe('context tabs', () => {
  test('the Table tab appears with the caret in a table, holds the table commands, and goes when it leaves', async ({ editor, page }) => {
    await openRibbon(editor);
    await page.getByRole('button', { name: 'Load Markdown sample' }).click();
    expect(await tabNames(page)).toEqual(['Home', 'Insert', 'Tools']);

    await editor.content.locator('td').first().click();
    expect(await tabNames(page)).toEqual(['Home', 'Insert', 'Tools', 'Table']);
    await expect(tab(page, 'Table')).toHaveAttribute('data-contextual', 'true');
    await expect(tab(page, 'Home')).toHaveAttribute('aria-selected', 'true'); // it does not steal the selection

    await tab(page, 'Table').click();
    const rows = editor.content.locator('tr');
    const before = await rows.count();
    await cmd(page, 'Insert row after').click();
    await expect(rows).toHaveCount(before + 1);
    await cmd(page, 'Insert column after').click();
    await expect(editor.content.locator('tr').first().locator('th, td')).toHaveCount(3);
    await cmd(page, 'Delete row').click();
    await expect(rows).toHaveCount(before);
  });

  test('leaving the table while on its tab returns to Home, and it does not jump back later', async ({ editor, page }) => {
    await openRibbon(editor);
    await page.getByRole('button', { name: 'Load Markdown sample' }).click();
    await editor.content.locator('td').first().click();
    await tab(page, 'Table').click();

    await editor.content.getByRole('heading').click();
    expect(await tabNames(page)).toEqual(['Home', 'Insert', 'Tools']);
    await expect(tab(page, 'Home')).toHaveAttribute('aria-selected', 'true');

    // Back into the table without touching the tabs: Home stays selected, the Table tab only becomes available.
    await editor.content.locator('td').first().click();
    await expect(tab(page, 'Table')).toBeVisible();
    await expect(tab(page, 'Home')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'Table')).toHaveAttribute('aria-selected', 'false');
  });

  test('Delete table removes the table and its tab', async ({ editor, page }) => {
    await openRibbon(editor);
    await page.getByRole('button', { name: 'Load Markdown sample' }).click();
    await editor.content.locator('td').first().click();
    await tab(page, 'Table').click();
    await cmd(page, 'Delete table').click();

    await expect(editor.content.locator('table')).toHaveCount(0);
    expect(await tabNames(page)).not.toContain('Table');
  });

  test('the Link tab appears on a link, opens it, edits it and removes it', async ({ editor, page }) => {
    await openRibbon(editor);
    await page.getByRole('button', { name: 'Load HTML sample' }).click();
    await editor.content.getByRole('link', { name: 'link', exact: true }).click();

    await expect(tab(page, 'Link')).toBeVisible();
    await tab(page, 'Link').click();
    await expect(ribbon(page).getByRole('link', { name: 'https://example.com' })).toHaveAttribute('href', 'https://example.com');
    await cmd(page, 'Edit link').click();
    await expect(page.getByRole('dialog', { name: 'Edit link' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Edit link' }).getByRole('button', { name: 'Cancel' }).click();

    await tab(page, 'Link').click();
    await cmd(page, 'Remove link').click();
    await expect(editor.content.getByRole('link')).toHaveCount(0);
    expect(await tabNames(page)).not.toContain('Link');
  });

  test('the Poetry tab appears in a couplet and its commands change the layout', async ({ editor, page }) => {
    await openRibbon(editor, { preset: 'poetry', locale: 'ur' });
    await tab(page, 'اوزار').waitFor(); // Tools, in Urdu
    expect(await tabNames(page)).not.toContain('شاعری');

    await tab(page, 'شامل کریں').click(); // Insert
    await cmd(page, 'شعر شامل کریں').click();
    await editor.type('شعر');

    await expect(tab(page, 'شاعری')).toHaveAttribute('data-contextual', 'true');
    await tab(page, 'شاعری').click();
    expect(await editor.html()).toContain('data-likhari-poetry-layout="single"');
    await cmd(page, 'دو کالم').click();
    await expect.poll(() => editor.html()).toContain('data-likhari-poetry-layout="two-column"');
  });
});

test.describe('only tabs with something in them are shown', () => {
  test('the minimal preset has no tabs at all, just the row of drafts, undo and the rest', async ({ editor, page }) => {
    await openRibbon(editor, { preset: 'minimal' });
    expect(await tabNames(page)).toEqual([]);
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await expect(page.getByRole('tabpanel')).toHaveCount(0);
    for (const name of ['Save', 'Undo', 'Redo']) await expect(quick(page).getByRole('button', { name })).toBeVisible();
    await expect(utilities(page).getByRole('button', { name: 'Drafts' })).toBeVisible();
    await expect(utilities(page).getByRole('link', { name: 'Help' })).toBeVisible();
  });

  test('turning off every insert feature removes the Insert tab', async ({ editor, page }) => {
    await openRibbon(editor);
    for (const name of ['Table', 'Columns', 'Footnotes', 'Page break']) await page.getByRole('checkbox', { name, exact: true }).uncheck();
    await expect(tab(page, 'Insert')).toBeVisible(); // links, images and rules are still on

    await page.getByRole('combobox', { name: 'Preset' }).selectOption('minimal');
    await expect(tab(page, 'Insert')).toHaveCount(0);
    await expect(tab(page, 'Home')).toHaveCount(0);
    await expect(tab(page, 'Tools')).toHaveCount(0);
  });

  test('a tab offers only the commands that are enabled', async ({ editor, page }) => {
    await openRibbon(editor, { preset: 'standard' });
    // Join lines only shows once the selection actually spans more than one line.
    await editor.type('first');
    await page.keyboard.press('Enter');
    await editor.type('second');
    await editor.selectAll();
    await tab(page, 'Tools').click();

    await expect(cmd(page, 'Join lines')).toBeVisible();
    await expect(cmd(page, 'Spell-checker')).toHaveCount(0);
    await expect(cmd(page, 'Auto-correct')).toHaveCount(0);
  });
});

test.describe('drafts, search and help sit on the tab row, outside every tab', () => {
  test('they are on the row after the tabs, and on no tab', async ({ editor, page }) => {
    await openRibbon(editor);
    for (const name of ['Drafts', 'Find and replace']) await expect(utilities(page).getByRole('button', { name })).toBeVisible();
    await expect(utilities(page).getByRole('link', { name: 'Help' })).toHaveAttribute('href', /markdown-dialect\.md$/);

    for (const name of ['Home', 'Insert', 'Tools']) {
      await tab(page, name).click();
      for (const button of ['Drafts', 'Find and replace']) await expect(utilities(page).getByRole('button', { name: button })).toBeVisible();
      for (const button of ['Drafts', 'Find and replace']) await expect(panel(page).getByRole('button', { name: button })).toHaveCount(0);
      await expect(panel(page).getByRole('link', { name: 'Help' })).toHaveCount(0);
    }
  });

  test('they are not inside the tab strip itself either', async ({ editor, page }) => {
    await openRibbon(editor);
    await expect(page.getByRole('tablist').getByRole('button')).toHaveCount(0);
    await expect(page.getByRole('tablist').getByRole('link')).toHaveCount(0);
  });

  test('search opens find and replace from any tab, and the button shows it is on', async ({ editor, page }) => {
    await openRibbon(editor);
    await editor.type('find me');
    await tab(page, 'Insert').click();
    await utilities(page).getByRole('button', { name: 'Find and replace' }).click();

    await expect(page.getByRole('search')).toBeVisible();
    await expect(utilities(page).getByRole('button', { name: 'Find and replace' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('search').getByRole('textbox', { name: 'Find' }).fill('find');
    await expect(page.getByRole('search').getByText('1 / 1')).toBeVisible();
  });

  test('drafts opens the drafts dialog from any tab', async ({ editor, page }) => {
    await openRibbon(editor);
    await tab(page, 'Tools').click();
    await utilities(page).getByRole('button', { name: 'Drafts' }).click();
    await expect(page.getByRole('dialog', { name: 'Saved drafts' })).toBeVisible();
  });

  test('they stay when there are no tabs at all', async ({ editor, page }) => {
    await openRibbon(editor, { preset: 'minimal' });
    await expect(utilities(page).getByRole('button', { name: 'Drafts' })).toBeVisible();
  });

  test('they stay beside a context tab', async ({ editor, page }) => {
    await openRibbon(editor);
    await page.getByRole('button', { name: 'Load Markdown sample' }).click();
    await editor.content.locator('td').first().click();
    await expect(tab(page, 'Table')).toBeVisible();
    await expect(utilities(page).getByRole('button', { name: 'Find and replace' })).toBeVisible();
  });

  test('zoom sits with the document tools on every tab, and not in any tab panel', async ({ editor, page }) => {
    await openRibbon(editor);
    await page.getByRole('checkbox', { name: 'Uniform font + zoom' }).check();
    for (const name of ['Home', 'Insert', 'Tools']) {
      await tab(page, name).click();
      await expect(utilities(page).getByRole('button', { name: 'Zoom in' })).toBeVisible();
      await expect(panel(page).getByRole('button', { name: /Zoom/ })).toHaveCount(0);
    }
  });

  test('the zoom buttons work from the row, and lead the other document tools', async ({ editor, page }) => {
    await openRibbon(editor);
    await page.getByRole('checkbox', { name: 'Uniform font + zoom' }).check();
    await editor.content.click();
    await editor.type('zoom me');
    const size = () => editor.content.locator('p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const before = await size();

    await utilities(page).getByRole('button', { name: 'Zoom in' }).click();
    await expect.poll(size).toBeGreaterThan(before);
    await utilities(page).getByRole('button', { name: /^Reset zoom to 100%/ }).click();
    await expect.poll(size).toBeCloseTo(before, 0);
    await utilities(page).getByRole('button', { name: 'Zoom out' }).click();
    await expect.poll(size).toBeLessThan(before);

    const zoom = (await utilities(page).getByRole('button', { name: 'Zoom out' }).boundingBox())!;
    const drafts = (await utilities(page).getByRole('button', { name: 'Drafts' }).boundingBox())!;
    expect(zoom.x).toBeLessThan(drafts.x);
  });

  test('zoom is still on the row with the ribbon collapsed', async ({ editor, page }) => {
    await openRibbon(editor);
    await page.getByRole('checkbox', { name: 'Uniform font + zoom' }).check();
    await utilities(page).getByRole('button', { name: 'Collapse the ribbon' }).click();
    await expect(utilities(page).getByRole('button', { name: 'Zoom in' })).toBeVisible();
    await expect(utilities(page).getByRole('button', { name: 'Zoom out' })).toBeVisible();
  });

  test('zoom follows the font-size feature: gone when it is off (minimal preset)', async ({ editor, page }) => {
    await openRibbon(editor);
    await page.getByRole('checkbox', { name: 'Uniform font + zoom' }).check();
    await expect(utilities(page).getByRole('button', { name: 'Zoom in' })).toBeVisible();

    await page.getByRole('combobox', { name: 'Preset' }).selectOption('minimal');
    await expect(utilities(page).getByRole('button', { name: 'Zoom in' })).toHaveCount(0);
  });

  test('save, undo and redo come before the tabs, drafts, search and help after them', async ({ editor, page }) => {
    await openRibbon(editor);
    const box = async (locator: ReturnType<Page['locator']>) => (await locator.boundingBox())!;
    const save = await box(quick(page).getByRole('button', { name: 'Save' }));
    const redo = await box(quick(page).getByRole('button', { name: 'Redo' }));
    const home = await box(tab(page, 'Home'));
    const tools = await box(tab(page, 'Tools'));
    const drafts = await box(utilities(page).getByRole('button', { name: 'Drafts' }));
    const help = await box(utilities(page).getByRole('link', { name: 'Help' }));

    expect(save.x).toBeLessThan(redo.x);
    expect(redo.x + redo.width).toBeLessThanOrEqual(home.x); // all of them left of the first tab
    expect(drafts.x).toBeGreaterThanOrEqual(tools.x + tools.width); // all of them right of the last tab
    expect(drafts.x).toBeLessThan(help.x);
  });

  test('the two groups are separate toolbars, each with its own name', async ({ editor, page }) => {
    await openRibbon(editor);
    await expect(quick(page).getByRole('button', { name: 'Drafts' })).toHaveCount(0);
    await expect(utilities(page).getByRole('button', { name: 'Save' })).toHaveCount(0);
  });

  test('in a right-to-left editor the two groups swap sides with the tabs', async ({ editor, page }) => {
    await openRibbon(editor, { locale: 'ur' });
    const quickBox = (await page.getByRole('toolbar', { name: 'فوری رسائی' }).boundingBox())!;
    const utilitiesBox = (await page.getByRole('toolbar', { name: 'دستاویز کے اوزار' }).boundingBox())!;
    const home = (await tab(page, 'ہوم').boundingBox())!;
    expect(quickBox.x).toBeGreaterThan(home.x); // save, undo and redo start on the right, before the tabs
    expect(utilitiesBox.x).toBeLessThan(home.x); // drafts, search and help are at the left end
  });
});

test.describe('the buttons on the tab row are flat', () => {
  type Look = { background: string; border: string; clusterBorder: string; clusterBackground: string };
  const look = (button: ReturnType<Page['locator']>): Promise<Look> =>
    button.evaluate((el) => {
      const c = getComputedStyle(el);
      const cluster = getComputedStyle(el.closest('.likhari-toolbar-cluster')!);
      return {
        background: c.backgroundColor,
        border: `${c.borderTopWidth} ${c.borderInlineStartWidth}`,
        clusterBorder: cluster.borderTopWidth,
        clusterBackground: cluster.backgroundColor,
      };
    });
  const TRANSPARENT = 'rgba(0, 0, 0, 0)';

  test('save, undo, redo, drafts, search and help have no border and no background', async ({ editor, page }) => {
    await openRibbon(editor);
    await page.mouse.move(0, 0);
    const buttons = [
      quick(page).getByRole('button', { name: 'Save' }),
      quick(page).getByRole('button', { name: 'Undo' }),
      quick(page).getByRole('button', { name: 'Redo' }),
      utilities(page).getByRole('button', { name: 'Drafts' }),
      utilities(page).getByRole('button', { name: 'Find and replace' }),
      utilities(page).getByRole('link', { name: 'Help' }),
    ];
    for (const button of buttons) {
      expect(await look(button), (await button.getAttribute('aria-label')) ?? undefined).toEqual({
        background: TRANSPARENT,
        border: '0px 0px',
        clusterBorder: '0px',
        clusterBackground: TRANSPARENT,
      });
    }
  });

  test('the zoom buttons are flat too', async ({ editor, page }) => {
    await openRibbon(editor);
    await page.getByRole('checkbox', { name: 'Uniform font + zoom' }).check();
    await page.mouse.move(0, 0);
    for (const name of ['Zoom out', /^Reset zoom to 100%/, 'Zoom in']) {
      expect(await look(utilities(page).getByRole('button', { name })), String(name)).toEqual({
        background: TRANSPARENT,
        border: '0px 0px',
        clusterBorder: '0px',
        clusterBackground: TRANSPARENT,
      });
    }
  });

  test('also in the plain (borderless) and filled toolbar variants', async ({ editor, page }) => {
    await openRibbon(editor);
    await page.getByRole('checkbox', { name: 'Bordered toolbar' }).uncheck();
    await page.getByRole('combobox', { name: 'Toolbar variant' }).selectOption('filled');
    await page.mouse.move(0, 0);
    expect((await look(quick(page).getByRole('button', { name: 'Undo' }))).background).toBe(TRANSPARENT);
    expect((await look(utilities(page).getByRole('button', { name: 'Drafts' }))).background).toBe(TRANSPARENT);
  });

  test('the buttons inside a tab keep their outlined groups', async ({ editor, page }) => {
    await openRibbon(editor);
    const bold = await look(panel(page).getByRole('button', { name: 'Bold' }));
    expect(bold.clusterBorder).toBe('1px');
    expect(bold.clusterBackground).not.toBe(TRANSPARENT);
  });

  test('hovering tints a button, so it still reads as a button', async ({ editor, page }) => {
    await openRibbon(editor);
    await editor.type('x');
    const undo = quick(page).getByRole('button', { name: 'Undo' });
    await undo.hover();
    expect((await look(undo)).background).not.toBe(TRANSPARENT);
    await page.mouse.move(0, 0);
    expect((await look(undo)).background).toBe(TRANSPARENT);
  });

  test('a disabled button is dimmed', async ({ editor, page }) => {
    await openRibbon(editor);
    await expect(quick(page).getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(await quick(page).getByRole('button', { name: 'Undo' }).evaluate((el) => getComputedStyle(el).opacity)).toBe('0.45');
  });

  test('Save shows unsaved changes with an accent icon and a dot, not a fill', async ({ editor, page }) => {
    await openRibbon(editor);
    const save = quick(page).getByRole('button', { name: 'Save' });
    const mark = () =>
      save.evaluate((el) => {
        const after = getComputedStyle(el, '::after');
        return { color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor, dot: after.content !== 'none' && after.width === '7px' };
      });
    expect((await mark()).dot).toBe(false);

    await editor.type('changed');
    await page.mouse.move(0, 0);
    expect(await mark()).toEqual({ color: 'rgb(43, 110, 110)', background: TRANSPARENT, dot: true });
  });

  test('search shows it is open with an accent icon and a bar, not a fill', async ({ editor, page }) => {
    await openRibbon(editor);
    const find = utilities(page).getByRole('button', { name: 'Find and replace' });
    await find.click();
    await page.mouse.move(0, 0);

    await expect(find).toHaveAttribute('aria-pressed', 'true');
    expect(
      await find.evaluate((el) => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor, bar: getComputedStyle(el, '::after').height })),
    ).toEqual({ color: 'rgb(43, 110, 110)', background: TRANSPARENT, bar: '2px' });
  });
});

test.describe('collapsing the ribbon', () => {
  const collapseButton = (page: Page) => utilities(page).getByRole('button', { name: 'Collapse the ribbon' });
  const expandButton = (page: Page) => utilities(page).getByRole('button', { name: 'Expand the ribbon' });
  const panelBox = async (page: Page) => (await page.getByRole('tabpanel').boundingBox())!;
  const contentTop = async (editor: EditorPage) => (await editor.content.boundingBox())!.y;

  test('the chevron on the row hides the command row and brings it back on the same tab', async ({ editor, page }) => {
    await openRibbon(editor);
    await tab(page, 'Insert').click();
    await expect(collapseButton(page)).toHaveAttribute('aria-expanded', 'true');

    await collapseButton(page).click();
    await expect(page.getByRole('tabpanel')).toHaveCount(0);
    await expect(panel(page)).toHaveCount(0);
    expect(await tabNames(page)).toEqual(['Home', 'Insert', 'Tools']); // the tabs stay
    await expect(expandButton(page)).toHaveAttribute('aria-expanded', 'false');

    await expandButton(page).click();
    await expect(tab(page, 'Insert')).toHaveAttribute('aria-selected', 'true');
    await expect(cmd(page, 'Insert table')).toBeVisible();
  });

  test('collapsing gives the canvas the room the command row used', async ({ editor, page }) => {
    await openRibbon(editor);
    const expanded = await contentTop(editor);
    await collapseButton(page).click();
    await expect.poll(() => contentTop(editor)).toBeLessThan(expanded - 30);

    await expandButton(page).click();
    await expect.poll(() => contentTop(editor)).toBe(expanded);
  });

  test('double-clicking a tab collapses the ribbon, and double-clicking again expands it', async ({ editor, page }) => {
    await openRibbon(editor);
    await tab(page, 'Home').dblclick();
    await expect(page.getByRole('tabpanel')).toHaveCount(0);
    await expect(expandButton(page)).toBeVisible();

    await tab(page, 'Insert').dblclick();
    await expect(page.getByRole('tabpanel')).toBeVisible();
    await expect(collapseButton(page)).toBeVisible();
    await expect(tab(page, 'Insert')).toHaveAttribute('aria-selected', 'true');
  });

  test('Ctrl+F1 collapses and expands it from the tabs', async ({ editor, page }) => {
    await openRibbon(editor);
    await tab(page, 'Home').focus();
    await page.keyboard.press('Control+F1');
    await expect(page.getByRole('tabpanel')).toHaveCount(0);
    await page.keyboard.press('Control+F1');
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });

  test('collapsed, no tab is selected and no panel is shown until a tab is clicked', async ({ editor, page }) => {
    await openRibbon(editor);
    await collapseButton(page).click();
    for (const name of ['Home', 'Insert', 'Tools']) await expect(tab(page, name)).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('tabpanel')).toHaveCount(0);
  });

  test('collapsed, clicking a tab shows its commands over the canvas without moving it', async ({ editor, page }) => {
    await openRibbon(editor);
    await collapseButton(page).click();
    const before = await contentTop(editor);

    await tab(page, 'Insert').click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
    await expect(tab(page, 'Insert')).toHaveAttribute('aria-selected', 'true');
    await expect(cmd(page, 'Insert table')).toBeVisible();
    expect(await contentTop(editor)).toBe(before); // nothing was pushed down
    expect((await panelBox(page)).y + (await panelBox(page)).height).toBeGreaterThan(before); // it sits over the canvas
    // The click on the panel must really reach its buttons, not the canvas underneath.
    await expect(cmd(page, 'Insert table')).toBeInViewport();
    await cmd(page, 'Insert table').click({ trial: true });
  });

  test('clicking the open tab again closes the peek, and another tab switches it', async ({ editor, page }) => {
    await openRibbon(editor);
    await collapseButton(page).click();
    await tab(page, 'Insert').click();
    await tab(page, 'Tools').click();
    await expect(tab(page, 'Tools')).toHaveAttribute('aria-selected', 'true');
    await expect(cmd(page, 'Spell-checker')).toBeVisible();

    await tab(page, 'Tools').click();
    await expect(page.getByRole('tabpanel')).toHaveCount(0);
  });

  test('a command chosen from the peeking panel runs and closes the panel', async ({ editor, page }) => {
    await openRibbon(editor);
    await editor.type('word');
    await editor.selectAll();
    await collapseButton(page).click();
    await tab(page, 'Home').click();
    await cmd(page, 'Bold').click();

    // Checked before reading the HTML back: that clicks a button outside the ribbon, which would close the panel itself.
    await expect(page.getByRole('tabpanel')).toHaveCount(0);
    expect(await editor.html()).toContain('<strong>word</strong>');
  });

  test('a dropdown in the peeking panel works: the panel stays open while one is chosen', async ({ editor, page }) => {
    await openRibbon(editor);
    await editor.type('a heading');
    await collapseButton(page).click();
    await tab(page, 'Home').click();
    await panel(page).getByRole('combobox', { name: 'Formatting', exact: true }).click();
    await page.getByRole('option', { name: 'Heading 2' }).click();

    expect(await editor.html()).toMatch(/<h2[^>]*>a heading/);
  });

  test('a menu opened from the peeking panel (More formatting) is not pulled away', async ({ editor, page }) => {
    await openRibbon(editor);
    await editor.type('word');
    await editor.selectAll();
    await collapseButton(page).click();
    await tab(page, 'Home').click();
    await cmd(page, 'More formatting').first().click();
    await page.getByRole('menuitem', { name: 'Superscript' }).click();

    expect(await editor.html()).toContain('<sup>');
  });

  test('Escape closes the peeking panel', async ({ editor, page }) => {
    await openRibbon(editor);
    await collapseButton(page).click();
    await tab(page, 'Insert').click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tabpanel')).toHaveCount(0);
  });

  test('clicking in the editor closes the peeking panel and keeps typing working', async ({ editor, page }) => {
    await openRibbon(editor);
    await collapseButton(page).click();
    await tab(page, 'Insert').click();
    await editor.content.click();
    await expect(page.getByRole('tabpanel')).toHaveCount(0);

    await editor.type('typed');
    await expect(editor.content).toHaveText('typed');
  });

  test('clicking elsewhere on the page closes the peeking panel', async ({ editor, page }) => {
    await openRibbon(editor);
    await collapseButton(page).click();
    await tab(page, 'Insert').click();
    await page.getByRole('heading', { level: 1 }).click();
    await expect(page.getByRole('tabpanel')).toHaveCount(0);
  });

  test('arrow keys move between tabs without opening the panel, Enter opens it', async ({ editor, page }) => {
    await openRibbon(editor);
    await collapseButton(page).click();
    await tab(page, 'Home').focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Insert')).toBeFocused();
    await expect(page.getByRole('tabpanel')).toHaveCount(0);

    await page.keyboard.press('Enter');
    await expect(tab(page, 'Insert')).toHaveAttribute('aria-selected', 'true');
    await expect(cmd(page, 'Insert table')).toBeVisible();
  });

  test('save, undo, redo, drafts and search stay put, and the context tabs still appear', async ({ editor, page }) => {
    await openRibbon(editor);
    await collapseButton(page).click();
    for (const name of ['Save', 'Undo', 'Redo']) await expect(quick(page).getByRole('button', { name })).toBeVisible();
    for (const name of ['Drafts', 'Find and replace']) await expect(utilities(page).getByRole('button', { name })).toBeVisible();

    await page.getByRole('button', { name: 'Load Markdown sample' }).click();
    await editor.content.locator('td').first().click();
    await expect(tab(page, 'Table')).toBeVisible();
    await tab(page, 'Table').click();
    await cmd(page, 'Insert row after').click();
    await expect(editor.content.locator('tr')).toHaveCount(3);
  });

  test('there is nothing to collapse without tabs, so no chevron', async ({ editor, page }) => {
    await openRibbon(editor, { preset: 'minimal' });
    await expect(collapseButton(page)).toHaveCount(0);
    await expect(expandButton(page)).toHaveCount(0);
  });

  test('the collapse button is flat like the rest of the row, and labelled in Urdu', async ({ editor, page }) => {
    await openRibbon(editor);
    await page.mouse.move(0, 0);
    expect(await collapseButton(page).evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, border: getComputedStyle(el).borderTopWidth }))).toEqual({
      bg: 'rgba(0, 0, 0, 0)',
      border: '0px',
    });
  });

  test('its name is translated', async ({ editor, page }) => {
    await openRibbon(editor, { locale: 'ur' });
    await expect(page.getByRole('toolbar', { name: 'دستاویز کے اوزار' }).getByRole('button', { name: 'ربن چھپائیں' })).toBeVisible();
  });

  test('a collapsed ribbon also works in a narrow window', async ({ editor, page }) => {
    await page.setViewportSize({ width: 560, height: 700 });
    await openRibbon(editor);
    await collapseButton(page).click();
    await tab(page, 'Insert').click();
    await expect(cmd(page, 'Insert table')).toBeAttached();
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });
});

test.describe('keyboard and accessibility', () => {
  test('tabs are a tablist with one tab in the tab order and a labelled panel', async ({ editor, page }) => {
    await openRibbon(editor);
    await expect(page.getByRole('tablist', { name: 'Ribbon tabs' })).toBeVisible();
    await expect(tab(page, 'Home')).toHaveAttribute('tabindex', '0');
    await expect(tab(page, 'Insert')).toHaveAttribute('tabindex', '-1');

    const panelEl = page.getByRole('tabpanel');
    await expect(panelEl).toHaveAttribute('aria-labelledby', (await tab(page, 'Home').getAttribute('id'))!);
    await expect(tab(page, 'Home')).toHaveAttribute('aria-controls', (await panelEl.getAttribute('id'))!);
  });

  test('arrow keys move between tabs and wrap, Home and End jump', async ({ editor, page }) => {
    await openRibbon(editor);
    await tab(page, 'Home').focus();

    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Insert')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'Insert')).toBeFocused();
    await page.keyboard.press('End');
    await expect(tab(page, 'Tools')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Home')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(tab(page, 'Tools')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(tab(page, 'Home')).toHaveAttribute('aria-selected', 'true');
  });

  test('in a right-to-left editor the arrows run the other way', async ({ editor, page }) => {
    await openRibbon(editor, { locale: 'ur' });
    await tab(page, 'ہوم').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(tab(page, 'شامل کریں')).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('languages and direction', () => {
  test('tab names are translated', async ({ editor, page }) => {
    await openRibbon(editor, { locale: 'ur' });
    expect(await tabNames(page)).toEqual(['ہوم', 'شامل کریں', 'اوزار']);
    await expect(page.getByRole('tablist', { name: 'ربن کے ٹیب' })).toBeVisible();
  });

  test('the tabs start on the right in a right-to-left editor', async ({ editor, page }) => {
    await openRibbon(editor, { locale: 'ur' });
    const home = (await tab(page, 'ہوم').boundingBox())!;
    const tools = (await tab(page, 'اوزار').boundingBox())!;
    expect(home.x).toBeGreaterThan(tools.x);
  });
});

test.describe('narrow windows', () => {
  test('the command row scrolls sideways instead of wrapping or losing commands', async ({ editor, page }) => {
    await page.setViewportSize({ width: 560, height: 700 });
    await openRibbon(editor);
    const toolbar = panel(page);

    const m = await toolbar.evaluate((el) => ({ overflowX: getComputedStyle(el).overflowX, wrap: getComputedStyle(el).flexWrap, scrollable: el.scrollWidth > el.clientWidth }));
    expect(m).toEqual({ overflowX: 'auto', wrap: 'nowrap', scrollable: true });

    // The last command on the tab can still be reached.
    await toolbar.getByRole('combobox', { name: 'Font size', exact: true }).scrollIntoViewIfNeeded();
    await expect(toolbar.getByRole('combobox', { name: 'Font size', exact: true })).toBeInViewport();
  });

  test('in a wide editor the tabs and the two button groups share one row', async ({ editor, page }) => {
    await openRibbon(editor);
    const tabs = (await page.getByRole('tablist').boundingBox())!;
    const quickBox = (await quick(page).boundingBox())!;
    expect(Math.abs(tabs.y - quickBox.y)).toBeLessThan(30);
  });

  test('in a narrow editor the tabs get a line of their own, and every tab can still be used', async ({ editor, page }) => {
    await page.setViewportSize({ width: 560, height: 700 });
    await openRibbon(editor);
    const tabs = (await page.getByRole('tablist').boundingBox())!;
    const quickBox = (await quick(page).boundingBox())!;
    expect(tabs.width).toBeGreaterThan(150); // not squeezed to nothing
    expect(tabs.y).toBeGreaterThan(quickBox.y + quickBox.height - 4); // below the save/undo group

    for (const name of ['Insert', 'Tools', 'Home']) {
      await tab(page, name).click();
      await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true');
    }
  });
});
