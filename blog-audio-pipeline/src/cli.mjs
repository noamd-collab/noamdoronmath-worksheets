export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      out[k] = v === undefined ? true : v;
    } else out._.push(a);
  }
  return out;
}
export function log(...a) { console.log(...a); }
export function fail(msg, code = 1) { console.error(`\n✗ ${msg}\n`); process.exit(code); }
