import type { Page } from '@playwright/test';
import { test, expect, type EditorPage } from '../support/fixtures';

const ribbon = (page: Page) => page.locator('.likhari-ribbon');
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const cmd = (page: Page, name: string | RegExp) => ribbon(page).getByRole('button', { name });
const panel = (page: Page) => page.getByRole('toolbar', { name: 'Formatting' });
const tabNames = (page: Page) => page.getByRole('tab').allInnerTexts();
const quick = (page: Page) => page.getByRole('toolbar', { name: 'Quick access' });

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
    await tab(page, 'Tools').click();

    for (const name of ['Auto-correct', 'Correct whole document', 'Spell-checker', 'Join lines']) {
      await expect(panel(page).getByRole('button', { name })).toBeVisible();
    }
    await expect(panel(page).getByRole('button', { name: 'Find and replace' })).toHaveCount(0);
  });

  test('View appears only in uniform font mode, and holds the zoom controls', async ({ editor, page }) => {
    await openRibbon(editor);
    await expect(tab(page, 'View')).toHaveCount(0);

    await page.getByRole('checkbox', { name: 'Uniform font + zoom' }).check();
    await tab(page, 'View').click();
    await expect(panel(page).getByRole('button', { name: 'Zoom in' })).toBeVisible();
    await expect(panel(page).getByRole('button', { name: 'Zoom out' })).toBeVisible();
    // Drafts, search and help are not on it: they are on the tab row.
    await expect(panel(page).getByRole('button', { name: 'Drafts' })).toHaveCount(0);
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
    for (const name of ['Drafts', 'Help', 'Save', 'Undo', 'Redo']) {
      await expect(quick(page).getByRole(name === 'Help' ? 'link' : 'button', { name })).toBeVisible();
    }
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
    await tab(page, 'Tools').click();

    await expect(cmd(page, 'Join lines')).toBeVisible();
    await expect(cmd(page, 'Spell-checker')).toHaveCount(0);
    await expect(cmd(page, 'Auto-correct')).toHaveCount(0);
  });
});

test.describe('drafts, search and help sit on the tab row, outside every tab', () => {
  test('they are on the row with save, undo and redo, and on no tab', async ({ editor, page }) => {
    await openRibbon(editor);
    for (const name of ['Drafts', 'Find and replace']) await expect(quick(page).getByRole('button', { name })).toBeVisible();
    await expect(quick(page).getByRole('link', { name: 'Help' })).toHaveAttribute('href', /markdown-dialect\.md$/);

    for (const name of ['Home', 'Insert', 'Tools']) {
      await tab(page, name).click();
      for (const button of ['Drafts', 'Find and replace']) await expect(quick(page).getByRole('button', { name: button })).toBeVisible();
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
    await quick(page).getByRole('button', { name: 'Find and replace' }).click();

    await expect(page.getByRole('search')).toBeVisible();
    await expect(quick(page).getByRole('button', { name: 'Find and replace' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('search').getByRole('textbox', { name: 'Find' }).fill('find');
    await expect(page.getByRole('search').getByText('1 / 1')).toBeVisible();
  });

  test('drafts opens the drafts dialog from any tab', async ({ editor, page }) => {
    await openRibbon(editor);
    await tab(page, 'Tools').click();
    await quick(page).getByRole('button', { name: 'Drafts' }).click();
    await expect(page.getByRole('dialog', { name: 'Saved drafts' })).toBeVisible();
  });

  test('they stay when there are no tabs at all', async ({ editor, page }) => {
    await openRibbon(editor, { preset: 'minimal' });
    await expect(quick(page).getByRole('button', { name: 'Drafts' })).toBeVisible();
  });

  test('they stay beside a context tab', async ({ editor, page }) => {
    await openRibbon(editor);
    await page.getByRole('button', { name: 'Load Markdown sample' }).click();
    await editor.content.locator('td').first().click();
    await expect(tab(page, 'Table')).toBeVisible();
    await expect(quick(page).getByRole('button', { name: 'Find and replace' })).toBeVisible();
  });

  test('the row keeps them at its end, after the tabs', async ({ editor, page }) => {
    await openRibbon(editor);
    const lastTab = (await tab(page, 'Tools').boundingBox())!;
    const drafts = (await quick(page).getByRole('button', { name: 'Drafts' }).boundingBox())!;
    const redo = (await quick(page).getByRole('button', { name: 'Redo' }).boundingBox())!;
    expect(drafts.x).toBeGreaterThan(lastTab.x + lastTab.width);
    expect(redo.x).toBeGreaterThan(drafts.x);
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

  test('the tabs and the save/undo/redo strip share one row', async ({ editor, page }) => {
    await page.setViewportSize({ width: 560, height: 700 });
    await openRibbon(editor);
    const tabs = (await page.getByRole('tablist').boundingBox())!;
    const quick = (await page.getByRole('toolbar', { name: 'Quick access' }).boundingBox())!;
    expect(Math.abs(tabs.y - quick.y)).toBeLessThan(30);
  });
});
