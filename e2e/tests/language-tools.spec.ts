import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';

/** The words currently underlined by the spellchecker, via the CSS Custom Highlight API. */
const misspelled = (page: Page) =>
  page.evaluate(() => [...(CSS as unknown as { highlights: Map<string, Set<Range>> }).highlights.get('likhari-spelling') ?? []].map((range) => range.toString()));

test.describe('spell check', () => {
  test('underlines unknown words and leaves known ones alone', async ({ editor, page }) => {
    await editor.open();
    await editor.type('hello helo wrold ');

    await expect.poll(() => misspelled(page)).toEqual(['helo', 'wrold']);
  });

  test('the panel steps through each misspelling', async ({ editor, page }) => {
    await editor.open();
    await editor.type('hello helo wrold ');
    await editor.button('Spell-checker').click();
    const panel = page.getByRole('region', { name: 'Spell check' });
    await panel.getByRole('button', { name: 'Check' }).click();

    await expect(panel.getByText('1 / 2')).toBeVisible();
    await expect(panel.getByText('helo', { exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Next' }).click();
    await expect(panel.getByText('2 / 2')).toBeVisible();
    await expect(panel.getByText('wrold', { exact: true })).toBeVisible();
  });

  test('the panel reports a clean document', async ({ editor, page }) => {
    await editor.open();
    await editor.type('hello world');
    await editor.button('Spell-checker').click();
    const panel = page.getByRole('region', { name: 'Spell check' });
    await panel.getByRole('button', { name: 'Check' }).click();

    await expect(panel.getByText('No misspellings found')).toBeVisible();
  });

  test('right-click offers suggestions, and choosing one fixes the word', async ({ editor, page }) => {
    await editor.open();
    await editor.type('a helo there ');
    await expect.poll(() => misspelled(page)).toEqual(['helo']);

    await editor.content.getByText('a helo there').click({ button: 'right', position: { x: 25, y: 8 } });
    await page.getByRole('menuitem', { name: 'hello', exact: true }).click();

    await expect(editor.content).toContainText('a hello there');
    await expect.poll(() => misspelled(page)).toEqual([]);
  });

  test('Ignore stops underlining that word', async ({ editor, page }) => {
    await editor.open();
    await editor.type('wrold ');
    await expect.poll(() => misspelled(page)).toEqual(['wrold']);

    await editor.content.getByText('wrold').click({ button: 'right', position: { x: 10, y: 8 } });
    await page.getByRole('menuitem', { name: 'Ignore', exact: true }).click();
    await expect.poll(() => misspelled(page)).toEqual([]);
  });

  test('Ctrl+Alt+I ignores the word at the caret, without the context menu', async ({ editor, page }) => {
    await editor.open();
    await editor.type('wrold ');
    await expect.poll(() => misspelled(page)).toEqual(['wrold']);

    await editor.content.getByText('wrold').click({ position: { x: 10, y: 8 } }); // places the caret in the word
    await page.waitForTimeout(100); // the click's selection reaches Lexical's editor state a tick after the click itself
    await page.keyboard.press('Control+Alt+I');
    await expect.poll(() => misspelled(page)).toEqual([]);
  });

  test('Ctrl+Alt+I still fires from a non-Latin keyboard layout, where the I key produces a different character', async ({ editor, page }) => {
    await editor.open();
    await editor.type('wrold ');
    await expect.poll(() => misspelled(page)).toEqual(['wrold']);

    await editor.content.getByText('wrold').click({ position: { x: 10, y: 8 } });
    await page.waitForTimeout(100); // the click's selection reaches Lexical's editor state a tick after the click itself
    // Simulates a layout (e.g. an Urdu one) where the physical I key types something other
    // than "i": event.code still names the physical key, which is what the shortcut must match.
    await editor.content.evaluate((el) => {
      el.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ی', code: 'KeyI', ctrlKey: true, altKey: true, bubbles: true, cancelable: true }),
      );
    });
    await expect.poll(() => misspelled(page)).toEqual([]);
  });

  test('Add to dictionary teaches the speller, and it is remembered after a reload', async ({ editor, page }) => {
    await editor.open();
    await editor.type('likhari ');
    await expect.poll(() => misspelled(page)).toEqual(['likhari']);

    await editor.content.getByText('likhari').click({ button: 'right', position: { x: 10, y: 8 } });
    await page.getByRole('menuitem', { name: 'Add to dictionary' }).click();
    await expect.poll(() => misspelled(page)).toEqual([]);

    await editor.reload();
    await editor.content.click();
    await editor.type('likhari ');
    await page.waitForTimeout(500);
    expect(await misspelled(page)).toEqual([]);
  });

  test('Ctrl+Alt+D adds the word at the caret to the dictionary', async ({ editor, page }) => {
    await editor.open();
    await editor.type('likhari ');
    await expect.poll(() => misspelled(page)).toEqual(['likhari']);

    await editor.content.getByText('likhari').click({ position: { x: 10, y: 8 } });
    await page.waitForTimeout(100); // the click's selection reaches Lexical's editor state a tick after the click itself
    await page.keyboard.press('Control+Alt+D');
    await expect.poll(() => misspelled(page)).toEqual([]);
  });

  test('checks Urdu text against the Urdu dictionary in right-to-left blocks', async ({ editor, page }) => {
    await editor.open({ locale: 'ur' });
    await editor.type('سلام دنیا غلطلفظ ', 15);

    await expect.poll(() => misspelled(page)).toEqual(['غلطلفظ']);
  });
});

test.describe('auto-correct', () => {
  async function addCorrection(page: Page, editor: import('../support/fixtures').EditorPage, from: string, to: string) {
    await editor.button('Auto-correct').click();
    const panel = page.getByRole('region', { name: 'Auto-correct' });
    await expect(panel.getByRole('button', { name: 'Save correction' })).toBeDisabled();
    await panel.getByRole('textbox', { name: 'Typed word' }).fill(from);
    await panel.getByRole('textbox', { name: 'Corrected word' }).fill(to);
    await panel.getByRole('button', { name: 'Save correction' }).click();
    await expect(panel.getByText('Saved. It applies to the next word typed.')).toBeVisible();
    await panel.getByRole('button', { name: 'Close' }).click();
    await editor.content.click();
  }

  test('a saved correction replaces the word as soon as it is finished', async ({ editor, page }) => {
    await editor.open();
    await addCorrection(page, editor, 'teh', 'the');
    await editor.type('teh quick', 20);

    await expect(editor.content).toHaveText('the quick');
  });

  test('only whole words are corrected', async ({ editor, page }) => {
    await editor.open();
    await addCorrection(page, editor, 'teh', 'the');
    await editor.type('tehran teh ', 20);

    await expect(editor.content).toHaveText('tehran the ');
  });

  test('corrections are kept for the next visit', async ({ editor, page }) => {
    await editor.open();
    await addCorrection(page, editor, 'recieve', 'receive');
    await editor.reload();
    await editor.content.click();
    await editor.type('recieve ', 20);

    await expect(editor.content).toContainText('receive');
  });

  test('"Add to auto-correct" on a misspelling opens the panel with the word filled in', async ({ editor, page }) => {
    await editor.open();
    await editor.type('wrold ');
    await expect.poll(() => misspelled(page)).toEqual(['wrold']);
    await editor.content.getByText('wrold').click({ button: 'right', position: { x: 10, y: 8 } });
    await page.getByRole('menuitem', { name: 'Add to auto-correct' }).click();

    const panel = page.getByRole('region', { name: 'Auto-correct' });
    await expect(panel.getByRole('textbox', { name: 'Typed word' })).toHaveValue('wrold');
  });

  test('Ctrl+Alt+A opens the auto-correct panel with the word at the caret filled in', async ({ editor, page }) => {
    await editor.open();
    await editor.type('wrold ');
    await expect.poll(() => misspelled(page)).toEqual(['wrold']);
    await editor.content.getByText('wrold').click({ position: { x: 10, y: 8 } });
    await page.waitForTimeout(100); // the click's selection reaches Lexical's editor state a tick after the click itself
    await page.keyboard.press('Control+Alt+A');

    const panel = page.getByRole('region', { name: 'Auto-correct' });
    await expect(panel.getByRole('textbox', { name: 'Typed word' })).toHaveValue('wrold');
  });

  test('"Correct whole document" fixes words that were never typed, and tidies spacing', async ({ editor, page }) => {
    await editor.open();
    await addCorrection(page, editor, 'teh', 'the');
    await editor.content.evaluate((el) => {
      const data = new DataTransfer();
      data.setData('text/plain', 'teh cat   and teh hat');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await editor.button('Correct whole document').click();

    await expect(editor.content).toHaveText('the cat and the hat');
  });

  test('can be turned off in the feature config, which removes its toolbar buttons', async ({ editor, page }) => {
    await editor.open({ preset: 'minimal' });

    await expect(editor.button('Auto-correct')).toHaveCount(0);
    await expect(editor.button('Correct whole document')).toHaveCount(0);
    await expect(editor.button('Spell-checker')).toHaveCount(0);
    void page;
  });
});

test.describe('Urdu punctuation and characters', () => {
  test('straight punctuation is replaced with Urdu punctuation as it is typed', async ({ editor }) => {
    await editor.open({ locale: 'ur' });
    await editor.type('سلام. کیا حال ہے? ٹھیک ہوں, شکریہ', 25);

    await expect(editor.content).toHaveText('سلام۔ کیا حال ہے؟ ٹھیک ہوں، شکریہ');
  });

  test('a straight double quote becomes a closing curly quote and a hyphen a full stop', async ({ editor }) => {
    await editor.open({ locale: 'ur' });
    await editor.type('کہا"', 25);
    await expect(editor.content).toHaveText('کہا”');

    await editor.type('ٹھیک-', 25);
    await expect(editor.content).toHaveText('کہا”ٹھیک۔');
  });

  test('Arabic heh is normalised to Urdu heh when the word is finished', async ({ editor }) => {
    await editor.open({ locale: 'ur' });
    await editor.type('کتابه ', 25);

    await expect(editor.content).toContainText('کتابہ');
    await expect(editor.content).not.toContainText('ه');
  });

  test('"Correct whole document" applies the punctuation rules to existing text', async ({ editor }) => {
    await editor.open({ locale: 'ur' });
    await editor.content.evaluate((el) => {
      const data = new DataTransfer();
      data.setData('text/plain', 'یہ کیا ہے? نہیں, ہے.');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await editor.button('تمام متن کی تصحیح کریں').click();

    await expect(editor.content).toHaveText('یہ کیا ہے؟ نہیں، ہے۔');
  });

  // Known bug: the punctuation fixes run in every block, so English prose typed in the
  // (LTR) editor gets Urdu punctuation. Remove `test.fail` once they are limited to RTL text.
  test.fail('English text keeps its own punctuation', async ({ editor }) => {
    await editor.open();
    await editor.type('Hello world. Is it? Yes, it is.', 25);

    await expect(editor.content).toHaveText('Hello world. Is it? Yes, it is.');
  });
});

test.describe('autocomplete', () => {
  test('suggests words from the dictionary and Tab accepts the highlighted one', async ({ editor, page }) => {
    await editor.open();
    await editor.type('qui', 20);

    const list = page.getByRole('listbox', { name: 'Suggestions' });
    await expect(list.getByRole('option', { name: 'quick' })).toBeVisible();
    await page.keyboard.press('Tab');

    await expect(editor.content).toHaveText('quick');
    await expect(list).toBeHidden();
  });

  test('Escape closes the list without inserting anything', async ({ editor, page }) => {
    await editor.open();
    await editor.type('qui', 20);
    await expect(page.getByRole('listbox', { name: 'Suggestions' })).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('listbox', { name: 'Suggestions' })).toBeHidden();
    await expect(editor.content).toHaveText('qui');
  });

  test('arrow keys move through the list and Enter accepts, but Enter alone still starts a new line', async ({ editor, page }) => {
    await editor.open();
    await editor.type('la', 20);
    const list = page.getByRole('listbox', { name: 'Suggestions' });
    await expect(list.getByRole('option')).toHaveCount(2); // large, lazy
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(editor.content).toHaveText(/^(large|lazy)$/);

    await page.keyboard.press('Enter');
    await editor.type('x');
    await expect(editor.content.locator('p')).toHaveCount(2);
  });

  test('a typed word that matches nothing shows no list', async ({ editor, page }) => {
    await editor.open();
    await editor.type('zzz', 20);
    await page.waitForTimeout(300);
    await expect(page.getByRole('listbox', { name: 'Suggestions' })).toHaveCount(0);
  });
});

test.describe('thesaurus', () => {
  test('right-click on a word lists its synonyms in a submenu, and picking one replaces the word', async ({ editor, page }) => {
    await editor.open();
    await editor.type('a big dog');
    await editor.content.getByText('a big dog').click({ button: 'right', position: { x: 22, y: 8 } });

    await page.getByRole('menuitem', { name: 'Synonyms' }).hover();
    await page.getByRole('menuitem', { name: 'large', exact: true }).click();
    await expect(editor.content).toHaveText('a large dog');
  });

  test('a correctly spelled word with no synonyms gets no Synonyms entry', async ({ editor, page }) => {
    await editor.open();
    await editor.type('hello'); // spelt right, but the test thesaurus knows nothing about it
    await editor.content.getByText('hello').click({ button: 'right', position: { x: 8, y: 8 } });
    await expect(page.getByRole('menu').first()).toBeVisible();
    await page.waitForTimeout(250); // let the (empty) synonym lookup resolve

    await expect(page.getByRole('menuitem', { name: 'Synonyms' })).toHaveCount(0);
  });

  test('a misspelled word gets no synonyms entry: its menu is the spelling fixes', async ({ editor, page }) => {
    await editor.open();
    await editor.type('zzz');
    await editor.content.getByText('zzz').click({ button: 'right', position: { x: 8, y: 8 } });

    await expect(page.getByRole('menuitem', { name: 'Ignore', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Synonyms' })).toHaveCount(0);
  });
});

test.describe('join lines', () => {
  test('is disabled for a single line and joins a selection of several into one paragraph', async ({ editor, page }) => {
    await editor.open();
    await editor.type('first');
    await expect(editor.button('Join lines')).toBeDisabled();
    await page.keyboard.press('Enter');
    await editor.type('second');
    await editor.selectAll();

    await editor.button('Join lines').click();
    await expect(editor.content.locator('p')).toHaveCount(1);
    await expect(editor.content).toContainText('first second');
  });

  test('Ctrl+Alt+M joins the selection, the same as the toolbar button', async ({ editor, page }) => {
    await editor.open();
    await editor.type('first');
    await page.keyboard.press('Enter');
    await editor.type('second');
    await editor.selectAll();

    await page.keyboard.press('Control+Alt+M');
    await expect(editor.content.locator('p')).toHaveCount(1);
    await expect(editor.content).toContainText('first second');
  });

  test('still fires from a non-Latin keyboard layout, where the M key produces a different character', async ({ editor, page }) => {
    await editor.open({ locale: 'ur' });
    await editor.type('اول');
    await page.keyboard.press('Enter');
    await editor.type('دوم');
    await editor.selectAll();

    // Simulates a layout (e.g. an Urdu one) where the physical M key types something other
    // than "m": event.code still names the physical key, which is what the shortcut must match.
    await editor.content.evaluate((el) => {
      el.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'م', code: 'KeyM', ctrlKey: true, altKey: true, bubbles: true, cancelable: true }),
      );
    });
    await expect(editor.content.locator('p')).toHaveCount(1);
  });
});
