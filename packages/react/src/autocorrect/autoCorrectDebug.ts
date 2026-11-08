/**
 * Auto-correct debug logging, off by default. Enable it for the current tab with:
 *   sessionStorage.setItem('likhari:debug-autocorrect', '1')
 * then reload. Disable by removing the key (or setting any other value).
 */
const SESSION_KEY = 'likhari:debug-autocorrect';

export function isAutoCorrectDebugEnabled(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function autoCorrectDebugLog(...args: unknown[]): void {
  if (isAutoCorrectDebugEnabled()) console.log('[autocorrect]', ...args);
}
