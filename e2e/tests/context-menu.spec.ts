import type { Page } from '@playwright/test';
import { test, expect, type EditorPage } from '../support/fixtures';

/** The menu itself; a submenu, when one is open, is the next `menu` in the document. */
const menu = (page: Page) => page.locator('[role="menu"]').first();
const submenu = (page: Page) => page.locator('[role="menu"]').nth(1);
const item = (page: Page, name: string | RegExp, exact = true) => page.getByRole('menuitem', { name, exact });

const rectOf = (locator: ReturnType<Page['locator']>) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, vw: innerWidth, vh: innerHeight, scrollable: el.scrollHeight > el.clientHeight + 1 };
  });

/** Right-clicks a word (the misspelled one, so spelling entries make the menu long). */
async function openMenuOnWord(editor: EditorPage, text: string, x = 10) {
  await editor.content.getByText(text).click({ button: 'right', position: { x, y: 8 } });
  await expect(menu(editor.page)).toBeVisible();
  await editor.page.waitForTimeout(250); // let positioning and the synonyms settle
}

async function expectInsideWindow(locator: ReturnType<Page['locator']>) {
  const r = await rectOf(locator);
  expect(r.left, 'left edge').toBeGreaterThanOrEqual(0);
  expect(r.top, 'top edge').toBeGreaterThanOrEqual(0);
  expect(r.right, 'right edge').toBeLessThanOrEqual(r.vw);
  expect(r.bottom, 'bottom edge').toBeLessThanOrEqual(r.vh);
}

test.describe('what the menu shows', () => {
  test('a misspelled word gets its spelling fixes and the cut, copy and paste row, and nothing else', async ({ editor, page }) => {
    await editor.open();
    await editor.type('a wrold here');
    await openMenuOnWord(editor, 'a wrold here', 30);

    await expect(page.getByText('Spelling suggestions')).toBeVisible();
    for (const name of ['world', 'Ignore', 'Add to dictionary', 'Add to auto-correct', 'Cut', 'Copy', 'Paste']) {
      await expect(item(page, name)).toBeVisible();
    }
    for (const name of ['Synonyms', 'Select all', 'Join lines', 'Insert row before', 'Link', 'Single column']) {
      await expect(item(page, name)).toHaveCount(0);
    }
  });

  test('a selection spanning a misspelled word is not treated as just that word: no spelling fixes, the usual selection options instead', async ({ editor, page }) => {
    await editor.open();
    await editor.type('a wrold here');
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End'); // select the whole line, including the misspelled word
    await editor.content.click({ button: 'right', position: { x: 30, y: 8 } }); // right-click inside the selection, on 'wrold'
    await expect(menu(page)).toBeVisible();
    await page.waitForTimeout(250);

    await expect(page.getByText('Spelling suggestions')).toHaveCount(0);
    for (const name of ['Ignore', 'Add to dictionary', 'Add to auto-correct', 'Synonyms']) await expect(item(page, name)).toHaveCount(0);
    for (const name of ['Join lines', 'Select all', 'Cut', 'Copy', 'Paste']) await expect(item(page, name)).toBeVisible();
  });

  test('also when the misspelled word is in a table cell: no table entries', async ({ editor, page }) => {
    await editor.open();
    await page.getByRole('button', { name: 'Load Markdown sample' }).click();
    const cell = editor.content.locator('td').first();
    await cell.click();
    await page.keyboard.press('End');
    await editor.type(' wrold');
    await cell.click({ button: 'right', position: { x: 52, y: 12 } });
    await expect(menu(page)).toBeVisible();
    await page.waitForTimeout(250);

    await expect(item(page, 'Ignore')).toBeVisible();
    await expect(item(page, 'Insert row before')).toHaveCount(0);
    await expect(item(page, 'Select all')).toHaveCount(0);
  });

  test('a correctly spelled word gets Synonyms, Join lines, the clipboard row and Select all', async ({ editor, page }) => {
    await editor.open();
    await editor.type('a big dog');
    await openMenuOnWord(editor, 'a big dog', 22);

    for (const name of ['Synonyms', 'Join lines', 'Cut', 'Copy', 'Paste', 'Select all']) await expect(item(page, name)).toBeVisible();
    for (const name of ['Ignore', 'Add to dictionary', 'Add to auto-correct']) await expect(item(page, name)).toHaveCount(0);
    await expect(page.getByText('Spelling suggestions')).toHaveCount(0);
  });

  test('where nothing applies it is just the clipboard row and Select all', async ({ editor, page }) => {
    await editor.open({ preset: 'minimal' });
    await editor.type('hello');
    await openMenuOnWord(editor, 'hello', 8);

    await expect(menu(page).getByRole('menuitem')).toHaveCount(4);
    for (const name of ['Cut', 'Copy', 'Paste', 'Select all']) await expect(item(page, name)).toBeVisible();
  });
});

test.describe('submenus', () => {
  test('Synonyms opens beside the menu on hover and lists the words', async ({ editor, page }) => {
    await editor.open();
    await editor.type('a big dog');
    await openMenuOnWord(editor, 'a big dog', 22);
    await expect(submenu(page)).toHaveCount(0);

    await item(page, 'Synonyms').hover();
    await expect(submenu(page)).toBeVisible();
    await expect(submenu(page).getByRole('menuitem', { name: 'large' })).toBeVisible();
    const parent = await rectOf(menu(page));
    const sub = await rectOf(submenu(page));
    expect(sub.left).toBeGreaterThanOrEqual(parent.right - 12); // beside it, not under it
  });

  test('a submenu also opens with a click and with the right-arrow key', async ({ editor, page }) => {
    await editor.open();
    await editor.type('a big dog');
    await openMenuOnWord(editor, 'a big dog', 22);
    await item(page, 'Synonyms').click();
    await expect(submenu(page)).toBeVisible();

    await page.keyboard.press('Escape');
    await openMenuOnWord(editor, 'a big dog', 22);
    await item(page, 'Synonyms').focus();
    await page.keyboard.press('ArrowRight');
    await expect(submenu(page)).toBeVisible();
  });

  test('Table shows its commands as icon buttons in the main menu and they work', async ({ editor, page }) => {
    await editor.open();
    await page.getByRole('button', { name: 'Load Markdown sample' }).click();
    const rows = editor.content.locator('tr');
    const before = await rows.count();
    await editor.content.locator('td').first().click({ button: 'right' });

    for (const name of ['Insert row before', 'Insert row after', 'Insert column before', 'Insert column after', 'Delete row', 'Delete column', 'Delete table']) {
      await expect(item(page, name)).toBeVisible();
    }
    await item(page, 'Insert row after').click();
    await expect(rows).toHaveCount(before + 1);
  });

  test('Link holds the link commands: open it, edit it, remove it', async ({ editor, page }) => {
    await editor.open();
    await page.getByRole('button', { name: 'Load HTML sample' }).click();
    await editor.content.getByRole('link', { name: 'link', exact: true }).click({ button: 'right' });

    await item(page, 'Link').hover();
    await expect(submenu(page).getByRole('menuitem', { name: 'https://example.com' })).toHaveAttribute('href', 'https://example.com');
    await expect(submenu(page).getByRole('menuitem', { name: 'Edit link' })).toBeVisible();
    await item(page, 'Remove link').click();
    await expect(editor.content.getByRole('link')).toHaveCount(0);
  });

  test('Poetry shows its commands as icon buttons in the main menu and they work', async ({ editor, page }) => {
    await editor.open({ preset: 'poetry', locale: 'ur' });
    await page.getByRole('button', { name: 'شعر شامل کریں' }).click();
    await editor.type('شعر');
    await editor.content.locator('.likhari-poetry').click({ button: 'right' });

    await expect(item(page, 'دو کالم')).toBeVisible();
    await item(page, 'دو کالم').click();
    await expect.poll(() => editor.html()).toContain('data-likhari-poetry-layout="two-column"');
  });

  test('submenu items are small like the rest', async ({ editor, page }) => {
    await editor.open();
    await editor.type('a big dog');
    await openMenuOnWord(editor, 'a big dog', 22);
    await item(page, 'Synonyms').hover();

    const size = await submenu(page).getByRole('menuitem', { name: 'large' }).evaluate((el) => ({ font: parseFloat(getComputedStyle(el).fontSize), height: el.getBoundingClientRect().height }));
    expect(size.font).toBeLessThanOrEqual(12);
    expect(size.height).toBeLessThanOrEqual(30);
  });

  test('a submenu stays inside the window, opening to the left when there is no room on the right', async ({ editor, page }) => {
    await page.setViewportSize({ width: 1000, height: 700 });
    await editor.open();
    await editor.type('a dog big'); // 'big' last, so it lands at the right-hand click point below, and it's the one word the test thesaurus gives a synonym
    const box = (await editor.content.boundingBox())!;
    await page.mouse.click(box.x + box.width - 4, box.y + 8, { button: 'right' }); // the right-hand end of the editor
    await expect(menu(page)).toBeVisible();
    await page.waitForTimeout(250);
    await item(page, 'Synonyms').hover();
    await expect(submenu(page)).toBeVisible();

    await expectInsideWindow(menu(page));
    await expectInsideWindow(submenu(page));
    expect((await rectOf(submenu(page))).left).toBeLessThan((await rectOf(menu(page))).left + 1); // it went to the left of the menu
  });
});

test.describe('the cut, copy and paste row', () => {
  test('is one row of three icon buttons, with no text label', async ({ editor, page }) => {
    await editor.open();
    await editor.type('hello');
    await openMenuOnWord(editor, 'hello', 8);

    const buttons = ['Cut', 'Copy', 'Paste'].map((name) => item(page, name));
    const boxes = await Promise.all(buttons.map(async (button) => (await button.boundingBox())!));
    expect(boxes[0].y).toBeCloseTo(boxes[1].y, 0);
    expect(boxes[1].y).toBeCloseTo(boxes[2].y, 0);
    expect(boxes[0].x).toBeLessThan(boxes[1].x);
    expect(boxes[1].x).toBeLessThan(boxes[2].x);
    for (const [index, button] of buttons.entries()) {
      expect(await button.innerText(), 'no visible label').toBe('');
      await expect(button.locator('svg')).toHaveCount(1);
      await expect(button).toHaveAttribute('title', ['Cut', 'Copy', 'Paste'][index]); // the tooltip
    }
  });

  test('is a labelled group in a single container', async ({ editor, page }) => {
    await editor.open();
    await editor.type('hello');
    await openMenuOnWord(editor, 'hello', 8);

    const row = menu(page).locator('.likhari-context-row');
    await expect(row).toHaveCount(1);
    await expect(row.getByRole('menuitem')).toHaveCount(3);
  });

  test('cut, copy and paste work from it', async ({ editor, page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await editor.open();
    await editor.type('move me');
    await editor.selectAll();
    await openMenuOnWord(editor, 'move me', 20);
    await item(page, 'Cut').click();
    await expect(editor.content).toHaveText('');

    await editor.content.click({ button: 'right' });
    await item(page, 'Paste').click();
    await expect(editor.content).toHaveText('move me');

    await editor.selectAll();
    await openMenuOnWord(editor, 'move me', 20);
    await item(page, 'Copy').click();
    await expect(editor.content).toHaveText('move me'); // copy leaves it in place
  });

  test('stays in the same place, last, on a misspelled word', async ({ editor, page }) => {
    await editor.open();
    await editor.type('wrold');
    await openMenuOnWord(editor, 'wrold', 10);

    const items = await menu(page).getByRole('menuitem').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? e.textContent));
    expect(items.slice(-3)).toEqual(['Cut', 'Copy', 'Paste']);
  });
});

test.describe('context menu size', () => {
  test('items are small: 12px text in compact rows', async ({ editor, page }) => {
    await editor.open();
    await editor.type('a big wrold');
    await openMenuOnWord(editor, 'a big wrold');

    const sizes = await menu(page).getByRole('menuitem').evaluateAll((els) =>
      els.map((el) => ({ font: parseFloat(getComputedStyle(el).fontSize), height: el.getBoundingClientRect().height })),
    );
    expect(sizes.length).toBeGreaterThan(4);
    for (const { font, height } of sizes) {
      expect(font).toBeLessThanOrEqual(12);
      expect(height).toBeLessThanOrEqual(30);
    }
  });

  test('icons are shrunk to match', async ({ editor, page }) => {
    await editor.open();
    await editor.type('hello');
    await editor.content.getByText('hello').click({ button: 'right' });

    expect((await item(page, 'Copy').locator('svg').first().boundingBox())!.width).toBeLessThanOrEqual(14);
  });

  test('Select all still works at the smaller size', async ({ editor, page }) => {
    await editor.open();
    await editor.type('hello world');
    await editor.content.getByText('hello world').click({ button: 'right' });
    await item(page, 'Select all').click();

    expect(await editor.content.evaluate(() => getSelection()!.toString())).toBe('hello world');
  });
});

test.describe('context menu stays on screen', () => {
  for (const [width, height] of [
    [1000, 700],
    [1000, 560],
    [800, 420],
    [1280, 330],
  ]) {
    test(`inside a ${width}x${height} window, even when it is longer than the window`, async ({ editor, page }) => {
      await page.setViewportSize({ width, height });
      await editor.open();
      await editor.type('a big wrold');
      await openMenuOnWord(editor, 'a big wrold');

      await expectInsideWindow(menu(page));
    });
  }

  test('a menu taller than the room scrolls, and its last item can still be reached', async ({ editor, page }) => {
    await page.setViewportSize({ width: 1280, height: 330 });
    await editor.open();
    await editor.type('a big wrold');
    await openMenuOnWord(editor, 'a big wrold');

    expect((await rectOf(menu(page))).scrollable).toBe(true);
    await item(page, 'Paste').click(); // scrolls it into view first
    await expect(menu(page)).toHaveCount(0);
  });

  test('a short menu is not cut and does not scroll when it fits', async ({ editor, page }) => {
    await editor.open();
    await editor.type('hello');
    await editor.content.getByText('hello').click({ button: 'right' });

    await expect(menu(page)).toBeVisible();
    expect((await rectOf(menu(page))).scrollable).toBe(false);
    await expectInsideWindow(menu(page));
  });

  test('opens near the right-hand edge without leaving the window', async ({ editor, page }) => {
    await page.setViewportSize({ width: 560, height: 700 });
    await editor.open();
    await editor.type('hello');
    const box = (await editor.content.boundingBox())!;
    await page.mouse.click(box.x + box.width - 4, box.y + 6, { button: 'right' });
    await expect(menu(page)).toBeVisible();

    await expectInsideWindow(menu(page));
  });

  test('opens near the bottom edge without leaving the window', async ({ editor, page }) => {
    await page.setViewportSize({ width: 1000, height: 480 });
    await editor.open();
    await editor.type('hello');
    const box = (await editor.content.boundingBox())!;
    await page.mouse.click(box.x + 20, Math.min(box.y + box.height - 4, 475), { button: 'right' });
    await expect(menu(page)).toBeVisible();

    await expectInsideWindow(menu(page));
  });

  test('the table menu fits a short window', async ({ editor, page }) => {
    await page.setViewportSize({ width: 1000, height: 420 });
    await editor.open();
    await page.getByRole('button', { name: 'Load Markdown sample' }).click();
    await editor.content.locator('td').first().click({ button: 'right' });
    await expect(item(page, 'Insert row after')).toBeAttached();

    await expectInsideWindow(menu(page));
  });

  test('right-to-left editors too', async ({ editor, page }) => {
    await page.setViewportSize({ width: 800, height: 420 });
    await editor.open({ locale: 'ur' });
    await editor.type('سلام دنیا');
    await editor.content.getByText('سلام دنیا').click({ button: 'right', position: { x: 10, y: 8 } });
    await expect(menu(page)).toBeVisible();
    await page.waitForTimeout(250);

    await expectInsideWindow(menu(page));
  });
});

test.describe('the menu lives outside the editor, so the editor does not react to it', () => {
  const editorMetrics = (page: Page) =>
    page.evaluate(() => {
      const root = document.querySelector('.likhari-root') as HTMLElement;
      const canvas = document.querySelector('.likhari-canvas') as HTMLElement;
      const paragraph = document.querySelector('.likhari-canvas p, .likhari-canvas td p') as HTMLElement;
      const box = paragraph.getBoundingClientRect();
      return {
        root: [root.scrollWidth, root.clientWidth, root.scrollHeight, root.clientHeight],
        canvas: [canvas.scrollWidth, canvas.clientWidth, canvas.scrollHeight, canvas.clientHeight],
        text: [Math.round(box.left), Math.round(box.top)],
      };
    });

  test('opening it, and a submenu, grows no scroll area in the editor and does not move the text', async ({ editor, page }) => {
    await page.setViewportSize({ width: 1100, height: 600 });
    await editor.open();
    await editor.type('a big dog');
    const before = await editorMetrics(page);

    await openMenuOnWord(editor, 'a big dog', 22);
    await item(page, 'Synonyms').hover();
    await expect(submenu(page)).toBeVisible();
    await page.waitForTimeout(300);

    expect(await editorMetrics(page)).toEqual(before);
  });

  test('is positioned against the window, not inside the editor', async ({ editor, page }) => {
    await editor.open();
    await editor.type('hello');
    await editor.content.getByText('hello').click({ button: 'right' });
    await expect(menu(page)).toBeVisible();

    const position = await menu(page).evaluate((el) => getComputedStyle(el.closest('[data-position], .mantine-Popover-dropdown, .mantine-Menu-dropdown') ?? el).position);
    expect(position).toBe('fixed');
  });

  test('is not cut off where the editor ends', async ({ editor, page }) => {
    await page.setViewportSize({ width: 1100, height: 700 });
    await editor.open();
    await page.getByRole('button', { name: 'Load Markdown sample' }).click();
    const root = (await page.locator('.likhari-root').boundingBox())!;
    const cell = (await editor.content.locator('td').last().boundingBox())!;
    // The last line of the editor: the menu opens there and runs past the editor's bottom edge.
    await page.mouse.click(cell.x + 20, Math.min(cell.y + cell.height - 6, root.y + root.height - 12), { button: 'right' });
    await expect(menu(page)).toBeVisible();
    await page.waitForTimeout(250);

    const probe = await page.evaluate(() => {
      const rootBox = (document.querySelector('.likhari-root') as HTMLElement).getBoundingClientRect();
      const dropdown = document.querySelector('[role="menu"]') as HTMLElement;
      const menuBox = dropdown.getBoundingClientRect();
      // A point near the menu's bottom edge: what is really drawn there?
      const hit = document.elementFromPoint(menuBox.left + 30, menuBox.bottom - 8);
      return { rootBottom: rootBox.bottom, menuBottom: menuBox.bottom, hitIsMenu: !!hit && dropdown.contains(hit), vh: innerHeight };
    });
    expect(probe.menuBottom, 'the menu runs past the editor').toBeGreaterThan(probe.rootBottom);
    expect(probe.menuBottom, 'but stays in the window').toBeLessThanOrEqual(probe.vh);
    expect(probe.hitIsMenu, 'and is drawn there').toBe(true);
  });

  test('it still takes the editor theme and direction', async ({ editor, page }) => {
    await editor.open({ locale: 'ur' });
    await editor.type('سلام');
    await editor.content.getByText('سلام').click({ button: 'right', position: { x: 8, y: 8 } });
    await expect(menu(page)).toBeVisible();

    expect(await menu(page).evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');
  });
});
