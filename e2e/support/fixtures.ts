import { expect, test as base, type Locator, type Page } from '@playwright/test';
import { mockNetwork, type NetworkGuard } from './mocks';

/** Page object for the demo app's editor. Locators use the editor's own accessible names. */
export class EditorPage {
  readonly content: Locator;
  readonly toolbar: Locator;

  constructor(readonly page: Page) {
    // Found by role and editability rather than by name, because the names are localised.
    this.content = page.locator('[role="textbox"][contenteditable="true"]');
    this.toolbar = page.getByRole('toolbar');
  }

  /** Opens the demo with a clean, English, light-mode editor. `prefs` seeds the demo's own settings. */
  async open(prefs: { locale?: 'en' | 'ur' | 'pa-shahmukhi'; preset?: 'minimal' | 'standard' | 'full' | 'poetry'; colorScheme?: 'light' | 'dark'; overflow?: boolean } = {}) {
    const { overflow = false, ...seed } = prefs;
    await this.page.addInitScript((seed) => {
      if (!localStorage.getItem('likhari-demo-prefs')) localStorage.setItem('likhari-demo-prefs', JSON.stringify(seed));
    }, { locale: 'en', preset: 'full', colorScheme: 'light', ...seed });
    this.overflow = overflow;
    await this.page.goto('/');
    await this.ready();
    await this.content.click();
  }

  private overflow = false;

  private async ready() {
    await expect(this.content).toBeVisible();
    if (!this.overflow) {
      // Keep every toolbar button on the bar instead of behind the "..." menu.
      await this.page.getByLabel('Toolbar overflow menu').uncheck();
    }
  }

  /** Puts values in localStorage before the page loads (once: a reload keeps whatever the page has since written). */
  async seedStorage(values: Record<string, string>) {
    await this.page.addInitScript((entries) => {
      if (sessionStorage.getItem('e2e-seeded')) return;
      sessionStorage.setItem('e2e-seeded', '1');
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    }, values);
  }

  /** The text of the draft autosaved for the demo document, or null. */
  async savedDraftText(): Promise<string | null> {
    return this.page.evaluate(() => {
      const raw = localStorage.getItem('likhari:draft:demo-doc');
      return raw ? ((JSON.parse(raw) as { preview?: string }).preview ?? '') : null;
    });
  }

  /** Reloads the page, as a user closing and reopening the document would. */
  async reload() {
    await this.page.reload();
    await this.ready();
  }

  button(name: string | RegExp) {
    return this.toolbar.getByRole('button', { name });
  }

  /** The demo's "Get ..." buttons and the output dialog they open. */
  async output(button: 'Get plain text' | 'Get HTML' | 'Get Markdown' | 'Get Lexical JSON'): Promise<string> {
    await this.page.getByRole('button', { name: button, exact: true }).click();
    const dialog = this.page.getByRole('dialog');
    const content = await dialog.locator('code').innerText();
    await dialog.getByRole('button', { name: 'Close' }).click();
    // Clicking the demo's buttons moved focus out of the editor; hand it back so typing can go on.
    await this.content.focus();
    return content;
  }

  /** Picks an option from one of the toolbar's dropdowns (block type, alignment, font ...). */
  async choose(dropdown: string, option: string | RegExp) {
    await this.toolbar.getByRole('combobox', { name: dropdown, exact: true }).click();
    await this.page.getByRole('option', { name: option, exact: typeof option === 'string' }).click();
  }

  /** Picks an item from a toolbar menu button such as "More formatting". */
  async menu(button: string, item: string | RegExp) {
    await this.button(button).click();
    await this.page.getByRole('menuitem', { name: item }).click();
  }

  /** Pastes plain text at the caret by dispatching a real paste event. */
  async paste(text: string) {
    await this.content.evaluate((el, value) => {
      const data = new DataTransfer();
      data.setData('text/plain', value);
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, text);
  }

  async html(): Promise<string> {
    return this.output('Get HTML');
  }

  /**
   * Types like a person. The auto-correct plugin fixes a word a tick after its last key, so
   * language tests pass a delay to keep each fix ahead of the next keystroke.
   */
  async type(text: string, delay = 0) {
    await this.page.keyboard.type(text, { delay });
  }

  async selectAll() {
    await this.page.keyboard.press('ControlOrMeta+A');
  }
}

export const test = base.extend<{ editor: EditorPage; network: NetworkGuard }>({
  network: async ({ context, baseURL }, use) => {
    const guard = await mockNetwork(context, new URL(baseURL!).origin);
    await use(guard);
    expect(guard.unmocked, 'requests that left the app without a mock').toEqual([]);
  },
  editor: async ({ page, network }, use) => {
    void network; // installs the mocks before any navigation
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await use(new EditorPage(page));
    expect(errors, 'uncaught page errors').toEqual([]);
  },
});

export { expect };
