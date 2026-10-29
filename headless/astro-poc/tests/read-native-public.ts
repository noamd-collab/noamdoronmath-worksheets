import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readBundledNativeSvg } from '../scripts/bundle-native-svg.mjs';

/** JSON stays on disk. Figure SVGs are read back from the grade bundle. */
export function readPublicText(target: URL): string {
  const path = fileURLToPath(target);
  if (existsSync(path)) return readFileSync(path, 'utf8');
  const bundled = readBundledNativeSvg(path);
  if (typeof bundled === 'string') return bundled;
  return readFileSync(path, 'utf8');
}
