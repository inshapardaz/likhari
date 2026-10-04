// Copies the spellcheck dictionary files from the React package's build into a
// bundle's output folder, so the editor can fetch them next to the bundle.
import { cpSync } from 'node:fs';

const [, , from, to] = process.argv;
if (!from || !to) {
  console.error('Usage: copy-dictionaries.mjs <react-dist-dictionaries-dir> <output-dir>');
  process.exit(1);
}
cpSync(from, to, { recursive: true });
