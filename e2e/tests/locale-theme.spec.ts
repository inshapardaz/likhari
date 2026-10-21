import { test, expect } from '../support/fixtures';

test.describe('languages and direction', () => {
  test('switching the language relabels the whole editor in Urdu', async ({ editor, page }) => {
    await editor.open();
    await page.locator('header select').first().selectOption('ur');

    await expect(editor.button('موٹا')).toBeVisible(); // Bold
    await expect(editor.button('ترچھا')).toBeVisible(); // Italic
    await expect(editor.content).toHaveAttribute('aria-label', 'ایڈیٹر کا مواد');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('لکھاری ڈیمو');
  });

  test('Shahmukhi Punjabi has its own strings', async ({ editor, page }) => {
    await editor.open({ locale: 'pa-shahmukhi' });

    await expect(editor.content).toHaveAttribute('aria-label', 'ایڈیٹر دی سامگری');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('لکھاری ڈیمو');
  });

  test('the chosen language is remembered across reloads', async ({ editor, page }) => {
    await editor.open();
    await page.locator('header select').first().selectOption('ur');
    await editor.reload();

    await expect(page.locator('header select').first()).toHaveValue('ur');
    await expect(editor.content).toHaveAttribute('aria-label', 'ایڈیٹر کا مواد');
  });

  test('Urdu is typed right to left', async ({ editor }) => {
    await editor.open({ locale: 'ur' });
    await editor.type('یہ اردو ہے');

    expect(await editor.html()).toContain('<p dir="rtl">یہ اردو ہے</p>');
    await expect(editor.content.locator('p').first()).toHaveCSS('direction', 'rtl');
  });

  test('English typed in an English editor is left to right', async ({ editor }) => {
    await editor.open();
    await editor.type('plain english');

    await expect(editor.content.locator('p').first()).toHaveCSS('direction', 'ltr');
    expect(await editor.html()).toContain('<p dir="ltr">plain english</p>');
  });

  test('a document can mix directions block by block', async ({ editor, page }) => {
    await editor.open();
    await page.getByRole('button', { name: 'Load HTML sample' }).click();

    await expect(editor.content.locator('p[dir="ltr"]')).toHaveCount(1);
    await expect(editor.content.locator('p[dir="rtl"]')).toHaveCount(1);
    await expect(editor.content.locator('p[dir="rtl"]')).toHaveCSS('direction', 'rtl');
  });

  test('alignment "start" follows the block direction', async ({ editor }) => {
    await editor.open({ locale: 'ur' });
    await editor.type('سلام');
    await expect(editor.content.locator('p').first()).toHaveCSS('text-align', 'start');
  });

  test('the demo page itself mirrors for right-to-left languages', async ({ editor, page }) => {
    await editor.open({ locale: 'ur' });
    await expect(page.locator('header > div').nth(1)).toHaveAttribute('dir', 'rtl');
  });

  test('typing in Urdu and English in one paragraph keeps both readable', async ({ editor }) => {
    await editor.open({ locale: 'ur' });
    await editor.type('اردو and English اردو');

    await expect(editor.content).toHaveText('اردو and English اردو');
  });
});

test.describe('theme', () => {
  const textColour = (editor: import('../support/fixtures').EditorPage) =>
    editor.content.evaluate((el) => {
      const [r, g, b] = getComputedStyle(el).color.match(/\d+/g)!.map(Number);
      return (r + g + b) / 3;
    });

  test('dark mode switches the editor to light text', async ({ editor, page }) => {
    await editor.open();
    await editor.type('theme check');
    const light = await textColour(editor);

    await page.getByRole('checkbox', { name: 'Dark mode' }).check();
    await expect.poll(() => textColour(editor)).toBeGreaterThan(light + 100);
  });

  test('dark mode is remembered across reloads', async ({ editor, page }) => {
    await editor.open();
    await page.getByRole('checkbox', { name: 'Dark mode' }).check();
    await editor.reload();

    await expect(page.getByRole('checkbox', { name: 'Dark mode' })).toBeChecked();
    expect(await textColour(editor)).toBeGreaterThan(150);
  });

  test('the accent colour reaches the editor', async ({ editor, page }) => {
    await editor.open();
    const accent = page.getByRole('textbox', { name: 'Accent color' });
    await accent.fill('#C2255C');
    await accent.press('Enter');

    await expect
      .poll(() => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('*')].some((el) => /#?c2255c|194, 37, 92/i.test(el.getAttribute('style') ?? ''))))
      .toBe(true);
  });
});
