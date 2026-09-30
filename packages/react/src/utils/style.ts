/** Sets (or replaces) one property in an inline CSS string like Lexical's
 * TextNode style, keeping every other property as-is. */
export function setStyleProperty(css: string, property: string, value: string): string {
  const entries = css
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const i = part.indexOf(':');
      return [part.slice(0, i).trim(), part.slice(i + 1).trim()] as const;
    })
    .filter(([name]) => name !== property);
  entries.push([property, value]);
  return entries.map(([name, val]) => `${name}: ${val};`).join(' ');
}
