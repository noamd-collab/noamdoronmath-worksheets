#!/usr/bin/env node
/**
 * Project deployment budget, NOT a documented Wix service limit.
 *
 * Wix CLI useLoadBuildFiles loads non-dot files from buildMetadata.serverDir
 * (excluding appManifestPath). getBackendFileData serializes each as
 * { path: relativePath, content: buffer.toString('base64') }, and
 * completeAppDeployment sends { appDeployment: { ...metadata, files } }.
 * Count that exact files serialization and wrapper, plus a conservative 16 KiB
 * allowance for deployment IDs/dates/URLs and any completion token. These
 * dynamic values do not exist before deployment and must never be logged here.
 *
 * The 19,500,000-byte project budget leaves headroom below the failed ~20.8 MB
 * request. It is deliberately independent of any undocumented provider limit.
 */
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_PAYLOAD_BUDGET_BYTES = 19_500_000;
export const DEPLOYMENT_METADATA_ALLOWANCE_BYTES = 16_384;

export async function measureWorkerPayload({ serverDir, appManifestPath, budgetBytes = PROJECT_PAYLOAD_BUDGET_BYTES }) {
  if (typeof serverDir !== 'string' || !serverDir || typeof appManifestPath !== 'string' || !appManifestPath) {
    throw new Error('Build metadata must identify the worker directory and app manifest.');
  }
  if (!Number.isSafeInteger(budgetBytes) || budgetBytes < 1) throw new Error('Invalid project payload budget.');
  const root = path.resolve(serverDir);
  const manifest = path.resolve(appManifestPath);
  let rootStat;
  try { rootStat = await lstat(root); } catch { throw new Error('Worker directory is missing or unreadable.'); }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Worker output must be a real directory.');
  const files = [];
  async function walk(dir) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { throw new Error('Worker directory is unreadable.'); }
    for (const entry of entries) {
      // globby("**/*", { onlyFiles: true }) uses dot:false in the Wix CLI.
      if (entry.name.startsWith('.')) continue;
      const absolute = path.join(dir, entry.name);
      if (absolute === manifest) continue;
      // The build emits regular files. Reject links instead of silently missing
      // their targets, following outside the build, or allowing symlink cycles.
      if (entry.isSymbolicLink()) throw new Error('Worker output contains a symbolic link; payload cannot be safely accounted for.');
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) files.push(absolute);
      else throw new Error('Worker output contains an unsupported file type.');
    }
  }
  await walk(root);
  if (!files.length) throw new Error('Worker output contains no deployable files.');
  let rawBytes = 0;
  let base64Bytes = 0;
  let fileRecordBytes = 0;
  for (const file of files.sort()) {
    let buffer;
    try { buffer = await readFile(file); } catch { throw new Error('A worker file is missing or unreadable.'); }
    const content = buffer.toString('base64');
    const relativePath = path.relative(root, file).split(path.sep).join('/');
    rawBytes += buffer.length;
    base64Bytes += Buffer.byteLength(content, 'utf8');
    fileRecordBytes += Buffer.byteLength(JSON.stringify({ path: relativePath, content }), 'utf8');
  }
  const filesJsonBytes = fileRecordBytes + 2 + files.length - 1; // brackets and commas
  const wrapperBytes = Buffer.byteLength(JSON.stringify({ appDeployment: { files: [] } }), 'utf8') - 2;
  const payloadBodyBytes = wrapperBytes + filesJsonBytes;
  const budgetedPayloadBytes = payloadBodyBytes + DEPLOYMENT_METADATA_ALLOWANCE_BYTES;
  return {
    fileCount: files.length,
    rawBytes,
    base64Bytes,
    filesJsonBytes,
    payloadBodyBytes,
    metadataAllowanceBytes: DEPLOYMENT_METADATA_ALLOWANCE_BYTES,
    budgetedPayloadBytes,
    projectBudgetBytes: budgetBytes,
    ok: budgetedPayloadBytes <= budgetBytes,
  };
}

export async function checkWixWorkerPayload(projectRoot = process.cwd()) {
  let metadata;
  try { metadata = JSON.parse(await readFile(path.join(projectRoot, '.wix/build-metadata.json'), 'utf8')); }
  catch { throw new Error('Wix build metadata is missing, unreadable, or invalid. Build before checking the payload.'); }
  if (!metadata || typeof metadata !== 'object' || typeof metadata.serverDir !== 'string' || typeof metadata.appManifestPath !== 'string') {
    throw new Error('Wix build metadata does not identify the worker output.');
  }
  // This project's Astro build uses CLI loadFiles, not the separately filtered
  // WIX_CONFIG loader. Reject an unknown future loading mode instead of guessing.
  if (metadata.metaDataSource === 'WIX_CONFIG') throw new Error('WIX_CONFIG file selection is unsupported by this Astro payload check.');
  return measureWorkerPayload({
    serverDir: path.resolve(projectRoot, metadata.serverDir),
    appManifestPath: path.resolve(projectRoot, metadata.appManifestPath),
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw new Error('This check takes no arguments; run it from the built Astro project.');
    const summary = await checkWixWorkerPayload();
    console.log(JSON.stringify(summary));
    if (!summary.ok) {
      console.error('Worker payload exceeds the project deployment budget. Reduce build size before release.');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`Worker payload check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
