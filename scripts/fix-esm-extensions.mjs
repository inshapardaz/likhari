// tsc (moduleResolution: "bundler") emits relative import/export specifiers
// without file extensions. Node's native ESM loader requires them, so this
// rewrites the compiled output in-place to add ".js" (or "/index.js").
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const distDir = process.argv[2];
if (!distDir) {
  console.error('Usage: fix-esm-extensions.mjs <dist-dir>');
  process.exit(1);
}

const specifierPattern = /((?:import|export)(?:[^'"]*?from\s*)?['"])(\.\.?\/[^'"]*)(['"])/g;

function resolveSpecifier(fileDir, specifier) {
  const abs = join(fileDir, specifier);
  try {
    const st = statSync(abs);
    if (st.isDirectory()) return `${specifier}/index.js`;
  } catch {
    // not a directory; assume it's a file missing its extension
  }
  if (specifier.endsWith('.js')) return specifier;
  return `${specifier}.js`;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.d.ts')) files.push(full);
  }
  return files;
}

for (const file of walk(distDir)) {
  const fileDir = dirname(file);
  const original = readFileSync(file, 'utf8');
  const rewritten = original.replace(specifierPattern, (match, prefix, specifier, suffix) => {
    return `${prefix}${resolveSpecifier(fileDir, specifier)}${suffix}`;
  });
  if (rewritten !== original) writeFileSync(file, rewritten);
}
