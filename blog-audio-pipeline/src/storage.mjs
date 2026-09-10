// Where the finished MP3 lives permanently.
//
// backend "github-pages" (default): the file is committed to the static asset repo
//   that already serves this site's images, and referenced by its absolute URL -
//   the same pattern the worksheet embeds already use. Removing a post's audio is
//   a delete plus a push, so a withdrawn post's file stops being served.
//
// backend "wix-media": uploads into the site's own Media Manager with
//   mediaManager.getUploadUrl(). Kept because it is the tidier long-term home, but
//   the exact upload response for audio has not been exercised on this site yet -
//   run one post with --no-upload first and check the returned descriptor.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { wixGetUploadUrl, wixUploadMp3 } from './wix.mjs';

export function storageBackend(cfg) {
  return cfg.storage?.backend || 'github-pages';
}

export async function publishAudio(cfg, { mp3Path, fileName, dev = false }) {
  const backend = storageBackend(cfg);
  if (backend === 'github-pages') return publishToGithubPages(cfg, { mp3Path, fileName });
  if (backend === 'wix-media') {
    const bytes = fs.statSync(mp3Path).size;
    const { uploadUrl } = await wixGetUploadUrl(cfg, { fileName, sizeInBytes: bytes, dev });
    const up = await wixUploadMp3(uploadUrl, mp3Path, fileName);
    return { backend, fileId: up.fileId, url: up.fileUrl, raw: up.raw };
  }
  throw new Error(`unknown storage backend "${backend}"`);
}

export async function unpublishAudio(cfg, { fileName }) {
  const backend = storageBackend(cfg);
  if (backend === 'github-pages') return removeFromGithubPages(cfg, { fileName });
  throw new Error(`unpublishAudio not implemented for backend "${backend}" - remove the file in the Wix Media Manager`);
}

function git(repoDir, args) {
  return execFileSync('/usr/bin/git', args, { cwd: repoDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function requireRepo(cfg) {
  const repoDir = process.env.BLOG_AUDIO_REPO_DIR || cfg.storage?.github?.repoDir;
  if (!repoDir) throw new Error('config.storage.github.repoDir is not set');
  if (!fs.existsSync(path.join(repoDir, '.git'))) throw new Error(`${repoDir} is not a git checkout`);
  return repoDir;
}

function publishToGithubPages(cfg, { mp3Path, fileName }) {
  const repoDir = requireRepo(cfg);
  const sub = cfg.storage.github.subdir || 'blog-audio';
  const branch = cfg.storage.github.branch || 'main';
  const destDir = path.join(repoDir, sub);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(mp3Path, path.join(destDir, fileName));

  const rel = `${sub}/${fileName}`;
  git(repoDir, ['add', '--', rel]);
  const staged = git(repoDir, ['diff', '--cached', '--name-only']);
  if (staged) {
    git(repoDir, ['commit', '-m', `Add narration audio for ${fileName.replace(/\.mp3$/, '')}`]);
    git(repoDir, ['push', 'origin', branch]);
  }
  const base = String(cfg.storage.github.publicBase || '').replace(/\/+$/, '');
  return {
    backend: 'github-pages',
    fileId: rel,
    url: `${base}/${sub}/${encodeURIComponent(fileName)}`,
    commit: staged ? git(repoDir, ['rev-parse', 'HEAD']) : null,
  };
}

function removeFromGithubPages(cfg, { fileName }) {
  const repoDir = requireRepo(cfg);
  const sub = cfg.storage.github.subdir || 'blog-audio';
  const branch = cfg.storage.github.branch || 'main';
  const rel = `${sub}/${fileName}`;
  if (!fs.existsSync(path.join(repoDir, rel))) return { removed: false, reason: 'file not in repo' };
  git(repoDir, ['rm', '--', rel]);
  git(repoDir, ['commit', '-m', `Remove narration audio for ${fileName.replace(/\.mp3$/, '')} (post no longer published)`]);
  git(repoDir, ['push', 'origin', branch]);
  return { removed: true, commit: git(repoDir, ['rev-parse', 'HEAD']) };
}
