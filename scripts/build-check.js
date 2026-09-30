// "Compilation" gate for a JavaScript codebase: JS has no compile step, so the
// closest blocking equivalent is proving every source module parses and every
// import resolves. A broken import or syntax error fails the build here.
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = resolve('src');
// server.js and migrate.js start listeners / touch the DB on import, so they are syntax-checked only.
const SIDE_EFFECT_ENTRYPOINTS = new Set(['server.js', 'migrate.js']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let failed = 0;
for (const file of walk(SRC).filter((f) => f.endsWith('.js'))) {
  const base = file.split(/[\\/]/).pop();
  try {
    if (SIDE_EFFECT_ENTRYPOINTS.has(base)) {
      const { spawnSync } = await import('node:child_process');
      const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error(r.stderr);
    } else {
      await import(pathToFileURL(file).href);
    }
    console.log(`ok   ${file.replace(SRC, 'src')}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${file.replace(SRC, 'src')}\n${err.message}`);
  }
}
if (failed) {
  console.error(`\nBuild check failed: ${failed} module(s).`);
  process.exit(1);
}
console.log('\nBuild check passed.');
