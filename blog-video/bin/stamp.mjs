#!/usr/bin/env node
// Records that a script was reviewed against the current post: writes the current
// source, cited-block and script hashes into script.json as "reviewedAgainst".
// Run only after reading the script against its post. It is not Noam's approval;
// that is recorded separately as contentStatus "noam-approved" in manifest.json.
// Usage: node blog-video/bin/stamp.mjs <postId>/<variant> [--by "name"]
import { writeFileSync } from 'node:fs';
import { loadPosts } from '../lib/source.mjs';
import { listPackages, readScript, refsHash, scriptHash } from '../lib/pipeline.mjs';
import { sourceHash } from '../lib/source.mjs';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const by = args.includes('--by') ? args[args.indexOf('--by') + 1] : 'unspecified';
if (!target) { console.error('usage: stamp.mjs <postId>/<variant> [--by name]'); process.exit(2); }
const pkg = listPackages().find((p) => `${p.postId}/${p.variant}` === target);
if (!pkg) { console.error(`no package ${target}`); process.exit(2); }
const post = loadPosts().find((x) => x.post.fileSlug === pkg.postId).post;
const script = readScript(pkg.scriptPath);
script.reviewedAgainst = { sourceHash: sourceHash(post), refsHash: refsHash(script, post), scriptHash: scriptHash(script), by, at: new Date().toISOString().slice(0, 10) };
writeFileSync(pkg.scriptPath, `${JSON.stringify(script, null, 2)}\n`);
console.log(`stamped ${target}`);
