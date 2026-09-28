// Copies non-TS assets (CSS, etc.) that tsc doesn't emit from src/ into dist/,
// preserving the relative directory structure.
import { readdirSync, statSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, relative, dirname, extname } from 'node:path';

const [, , srcDir, distDir, extPattern] = process.argv;
if (!srcDir || !distDir || !extPattern) {
  console.error('Usage: copy-assets.mjs <src-dir> <dist-dir> "<glob-like-ext-pattern>"');
  process.exit(1);
}

const wantedExt = extPattern.replace(/^\*\*\/\*/, '');

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (extname(entry.name) === wantedExt) files.push(full);
  }
  return files;
}

for (const file of walk(srcDir)) {
  const rel = relative(srcDir, file);
  const dest = join(distDir, rel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(file, dest);
}
