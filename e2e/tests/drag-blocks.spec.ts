import { expect, test } from '../support/fixtures';

/** Drags from one locator's centre to a point in another, through the real HTML5 drag events. */
async function dragTo(page: import('@playwright/test').Page, from: import('@playwright/test').Locator, to: import('@playwright/test').Locator, where: 'top' | 'bottom') {
  const source = (await from.boundingBox())!;
  const target = (await to.boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  // A couple of intermediate moves so the browser starts the drag and fires dragover on the way.
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 4 });
  const y = where === 'top' ? target.y + 3 : target.y + target.height - 3;
  await page.mouse.move(target.x + target.width / 2, y, { steps: 4 });
  await page.mouse.up();
}

test.describe('drag grip', () => {
  test('hovering a paragraph shows a grip, and dragging it moves the paragraph', async ({ editor, page }) => {
    await editor.open();
    await editor.type('first');
    await page.keyboard.press('Enter');
    await editor.type('second');
    await page.keyboard.press('Enter');
    await editor.type('third');

    const paragraphs = editor.content.locator('p');
    await paragraphs.first().hover();
    const grip = page.getByRole('button', { name: 'Drag to move' });
    await expect(grip).toBeVisible();

    await dragTo(page, grip, paragraphs.last(), 'bottom');
    await expect(paragraphs).toHaveText(['second', 'third', 'first']);
  });

  test('inside poetry, one grip moves the couplet and another swaps the line', async ({ editor, page }) => {
    await editor.open({ preset: 'poetry', locale: 'ur' });
    // The 'poetry' preset's default layouts list has more than one entry, so
    // the insert button is a menu (layout choices) rather than a direct insert.
    await editor.menu('شعر شامل کریں', 'ایک کالم');
    await editor.type('a1');
    await page.keyboard.press('Enter');
    await editor.type('a2');
    await page.keyboard.press('Enter');
    await editor.type('b1');
    await page.keyboard.press('Enter');
    await editor.type('b2');

    const lines = editor.content.locator('.likhari-poetry .likhari-paragraph');
    await expect(lines).toHaveText(['a1', 'a2', 'b1', 'b2']);

    // Swap b2 with a1 by dragging the line grip.
    await lines.last().hover();
    const lineGrip = page.getByRole('button', { name: 'دوسرے مصرعے سے بدلنے کے لیے اس پر گھسیٹیں' });
    await expect(lineGrip).toBeVisible();
    await dragTo(page, lineGrip, lines.first(), 'top');
    await expect(lines).toHaveText(['b2', 'a2', 'b1', 'a1']);

    // Move the second couplet above the first by dragging the couplet grip.
    await lines.last().hover();
    const coupletGrip = page.getByRole('button', { name: 'یہ شعر منتقل کرنے کے لیے گھسیٹیں' });
    await expect(coupletGrip).toBeVisible();
    await dragTo(page, coupletGrip, lines.first(), 'top');
    await expect(lines).toHaveText(['b1', 'a1', 'b2', 'a2']);

    // The hover controls keep working after a drop (they are disabled only while a drag is in flight).
    await expect(editor.page.locator('.likhari-dragging')).toHaveCount(0);
    await page.getByRole('button', { name: 'نیچے شعر شامل کریں' }).click({ force: true });
    await expect(lines).toHaveCount(6);
  });
});
