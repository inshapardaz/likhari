import type { Page } from '@playwright/test';
import { test, expect, type EditorPage } from '../support/fixtures';

const menu = (page: Page) => page.getByRole('menu');

const rectOf = (page: Page) =>
  menu(page).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, vw: innerWidth, vh: innerHeight, scrollable: el.scrollHeight > el.clientHeight + 1 };
  });

/** Right-clicks a word (the misspelled one, so spelling and synonym entries make the menu long). */
async function openMenuOnWord(editor: EditorPage, word: string) {
  await editor.content.getByText(word).click({ button: 'right', position: { x: 10, y: 8 } });
  await expect(menu(editor.page)).toBeVisible();
  await editor.page.waitForTimeout(250); // let positioning and the synonyms settle
}

async function expectInsideWindow(page: Page) {
  const r = await rectOf(page);
  expect(r.left, 'left edge').toBeGreaterThanOrEqual(0);
  expect(r.top, 'top edge').toBeGreaterThanOrEqual(0);
  expect(r.right, 'right edge').toBeLessThanOrEqual(r.vw);
  expect(r.bottom, 'bottom edge').toBeLessThanOrEqual(r.vh);
}

test.describe('context menu size', () => {
  test('items are small: 12px text in compact rows', async ({ editor, page }) => {
    await editor.open();
    await editor.type('a big wrold');
    await openMenuOnWord(editor, 'a big wrold');

    const items = menu(page).getByRole('menuitem');
    const sizes = await items.evaluateAll((els) =>
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
    const icon = menu(page).getByRole('menuitem', { name: 'Copy' }).locator('svg').first();

    expect((await icon.boundingBox())!.width).toBeLessThanOrEqual(14);
  });

  test('the menu keeps its actions working at the smaller size', async ({ editor, page }) => {
    await editor.open();
    await editor.type('hello world');
    await editor.content.getByText('hello world').click({ button: 'right' });
    await menu(page).getByRole('menuitem', { name: 'Select all' }).click();

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

      await expectInsideWindow(page);
    });
  }

  test('a menu taller than the room scrolls, and its last item can still be reached', async ({ editor, page }) => {
    await page.setViewportSize({ width: 1280, height: 330 });
    await editor.open();
    await editor.type('a big wrold');
    await openMenuOnWord(editor, 'a big wrold');

    expect((await rectOf(page)).scrollable).toBe(true);
    await menu(page).getByRole('menuitem', { name: 'Select all' }).click(); // scrolls it into view first
    expect(await editor.content.evaluate(() => getSelection()!.toString())).toBe('a big wrold');
  });

  test('a short menu is not cut and does not scroll when it fits', async ({ editor, page }) => {
    await editor.open();
    await editor.type('hello');
    await editor.content.getByText('hello').click({ button: 'right' });

    await expect(menu(page)).toBeVisible();
    const r = await rectOf(page);
    expect(r.scrollable).toBe(false);
    await expectInsideWindow(page);
  });

  test('opens near the right-hand edge without leaving the window', async ({ editor, page }) => {
    await page.setViewportSize({ width: 560, height: 700 });
    await editor.open();
    await editor.type('hello');
    const box = (await editor.content.boundingBox())!;
    await page.mouse.click(box.x + box.width - 4, box.y + 6, { button: 'right' });
    await expect(menu(page)).toBeVisible();

    await expectInsideWindow(page);
  });

  test('opens near the bottom edge without leaving the window', async ({ editor, page }) => {
    await page.setViewportSize({ width: 1000, height: 480 });
    await editor.open();
    await editor.type('hello');
    const box = (await editor.content.boundingBox())!;
    await page.mouse.click(box.x + 20, Math.min(box.y + box.height - 4, 475), { button: 'right' });
    await expect(menu(page)).toBeVisible();

    await expectInsideWindow(page);
  });

  test('the table menu, the tallest one, fits a short window', async ({ editor, page }) => {
    await page.setViewportSize({ width: 1000, height: 420 });
    await editor.open();
    await page.getByRole('button', { name: 'Load Markdown sample' }).click();
    await editor.content.locator('td').first().click({ button: 'right' });
    await expect(menu(page).getByRole('menuitem', { name: 'Insert row after' })).toBeAttached();

    await expectInsideWindow(page);
  });

  test('right-to-left editors too', async ({ editor, page }) => {
    await page.setViewportSize({ width: 800, height: 420 });
    await editor.open({ locale: 'ur' });
    await editor.type('سلام دنیا');
    await editor.content.getByText('سلام دنیا').click({ button: 'right', position: { x: 10, y: 8 } });
    await expect(menu(page)).toBeVisible();
    await page.waitForTimeout(250);

    await expectInsideWindow(page);
  });
});
