#!/usr/bin/env node
// Regenerates every generated file under blog-video/ (package files, social.md,
// manifest.json, inventory.json/.csv). Keeps production/publish state already recorded.
// Usage: node blog-video/bin/build.mjs
import { writeFileSync } from 'node:fs';
import { buildAll } from '../lib/build.mjs';

const { files, errors, warnings, manifest, inventory } = buildAll();
for (const [p, s] of files) writeFileSync(p, s);
for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);
console.log(`built ${manifest.videos.length} videos; inventory ${inventory.posts.length} posts; ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
