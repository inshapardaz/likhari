import type { BrowserContext, Request, Route } from '@playwright/test';

/** Tiny Hunspell dictionaries, so spellcheck is deterministic and nothing is downloaded. */
const EN_AFF = 'SET UTF-8\nTRY esianrtolcdugmphbyfvkwz\n';
const EN_WORDS = ['hello', 'world', 'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog', 'this', 'is', 'a', 'test', 'and', 'bold', 'italic', 'big', 'large', 'there', 'cat', 'hat', 'bat'];
const UR_AFF = 'SET UTF-8\n';
const UR_WORDS = ['سلام', 'دنیا', 'یہ', 'اردو', 'کا', 'ہے', 'میں', 'اور'];

const dic = (words: string[]) => `${words.length}\n${words.join('\n')}\n`;

/** WordNet fixtures: "big" has the synonym "large"; every other file is empty. */
const WORDNET: Record<string, string> = {
  'index.adj': 'big a 1 0 1 0 00000001\n',
  'data.adj': '00000001 00 a 02 big 0 large 0 000 | above average size\n',
};

/** A 1x1 transparent PNG, served for the fake image host below. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

/** Host that tests use for image URLs; answered here so no real image is fetched. */
export const IMAGE_URL = 'https://images.example.test/photo.png';

export interface NetworkGuard {
  /** Requests that left the app's own origin without a mock. Tests assert this is empty. */
  unmocked: string[];
  /** Every request a mock answered, as `METHOD url`, for tests that assert something was (not) fetched. */
  mocked: string[];
}

const text = (route: Route, body: string, contentType = 'text/plain; charset=utf-8') =>
  route.fulfill({ status: 200, contentType, body, headers: { 'access-control-allow-origin': '*' } });

/**
 * Mocks every network call the editor can make and records anything that is not
 * mocked. Requests to the app's own origin (the demo's HTML and bundles) pass
 * through; the dictionaries it serves itself are replaced with small fixtures.
 * Everything else (fonts and WordNet on jsDelivr, any API) is answered here or
 * aborted and reported, so a test can never depend on the real network.
 */
export async function mockNetwork(context: BrowserContext, appOrigin: string): Promise<NetworkGuard> {
  const guard: NetworkGuard = { unmocked: [], mocked: [] };
  const note = (request: Request) => guard.mocked.push(`${request.method()} ${request.url()}`);

  await context.route(
    (url) => url.origin !== appOrigin && url.protocol.startsWith('http'),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.hostname === 'images.example.test') {
        note(request);
        return route.fulfill({ status: 200, contentType: 'image/png', body: PNG, headers: { 'access-control-allow-origin': '*' } });
      }
      if (url.hostname === 'cdn.jsdelivr.net') {
        note(request);
        if (url.pathname.startsWith('/gh/inshapardaz/urdu-web-fonts@')) {
          // Font stylesheets and files: empty, the editor only needs the request to succeed.
          return text(route, '', url.pathname.endsWith('.css') ? 'text/css' : 'application/octet-stream');
        }
        const file = url.pathname.match(/^\/npm\/wordnet-db@[^/]+\/dict\/(.+)$/)?.[1];
        if (file !== undefined) return text(route, WORDNET[file] ?? '');
      }
      guard.unmocked.push(`${request.method()} ${request.url()}`);
      return route.abort('blockedbyclient');
    },
  );

  // The dictionaries the demo serves from its own origin (the English pair is only copied
  // into public/ by a build step, so it may not exist at all in a dev checkout).
  const ownFiles: Record<string, string> = {
    '/dictionaries/en/index.aff': EN_AFF,
    '/dictionaries/en/index.dic': dic(EN_WORDS),
    '/dictionaries/ur-spell/index.aff': UR_AFF,
    '/dictionaries/ur-spell/index.dic': dic(UR_WORDS),
  };
  await context.route(
    (url) => url.origin === appOrigin && Object.keys(ownFiles).some((suffix) => url.pathname.endsWith(suffix)),
    (route) => {
      const { pathname } = new URL(route.request().url());
      note(route.request());
      return text(route, ownFiles[Object.keys(ownFiles).find((suffix) => pathname.endsWith(suffix))!]);
    },
  );

  return guard;
}
