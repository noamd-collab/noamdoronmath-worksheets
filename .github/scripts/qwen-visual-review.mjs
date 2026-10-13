/**
 * Advisory Qwen visual review.
 * Serves nothing itself: the workflow serves the built site first.
 * Skips when CHINESE_MODELS_API_KEY is missing. Never prints the key.
 *
 *   CHINESE_MODELS_API_KEY=... BASE_URL=http://127.0.0.1:4321 BASE_SHA=... \
 *     node .github/scripts/qwen-visual-review.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { upsertPullRequestComment } from './pr-comment.mjs';
import { pagesTouchedByDiff } from './pr-pages.mjs';
import { redactSecrets } from './redact.mjs';

const MARKER = '<!-- astro-poc-qwen-visual-review -->';
const ENDPOINT = 'https://token-plan.maas.qwencloudapi.com/compatible-mode/v1/chat/completions';
const MODELS = ['qwen3.8-max'];
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];

function completionUrls() {
  return [ENDPOINT];
}

function changedFiles() {
  if (process.env.CHANGED_FILES) {
    return process.env.CHANGED_FILES.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  const base = process.env.BASE_SHA;
  if (!base) return [];
  try {
    const out = execFileSync('git', ['diff', '--name-only', '--find-renames', base, 'HEAD'], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    return out.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch (error) {
    console.error(redactSecrets(error instanceof Error ? error.message : 'git diff failed'));
    console.error('Using fallback pages.');
    return [];
  }
}

function slug(page) {
  const cleaned = page.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  return cleaned || 'home';
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

async function loadPlaywright() {
  const specifier = process.env.PLAYWRIGHT_MODULE || 'playwright';
  const imported = await import(specifier);
  const api = imported.chromium ? imported : imported.default;
  if (!api?.chromium) throw new Error('Playwright did not export chromium');
  return api;
}

export async function captureScreenshots({ baseUrl, pages, outDir }) {
  const { chromium } = await loadPlaywright();
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const shots = [];
  try {
    for (const pageUrl of pages) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          locale: 'he-IL',
          deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        const target = new URL(pageUrl, baseUrl).href;
        const file = join(outDir, `${slug(pageUrl)}-${viewport.name}.png`);
        let status = 0;
        let error = '';
        try {
          const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
          status = response?.status() ?? 0;
          await page.waitForTimeout(750);
          await page.screenshot({ path: file, fullPage: false, type: 'png' });
          shots.push({ file, pageUrl, viewport: viewport.name, width: viewport.width, status });
        } catch (err) {
          error = err instanceof Error ? err.message : 'screenshot failed';
          shots.push({ file, pageUrl, viewport: viewport.name, width: viewport.width, status, error });
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  return shots;
}

function imageContent(shots) {
  const parts = [];
  for (const shot of shots) {
    if (shot.error || !shot.file) continue;
    let bytes;
    try {
      bytes = readFileSync(shot.file);
    } catch {
      continue;
    }
    const mime = 'image/png';
    parts.push({
      label: `${shot.pageUrl} @ ${shot.viewport} ${shot.width}px status ${shot.status}`,
      mime,
      base64: bytes.toString('base64'),
    });
  }
  return parts;
}

async function callModel(endpoint, model, images, extraFields) {
  const prompt = [
    'You are reviewing screenshots of a Hebrew RTL math-worksheet site.',
    'Each image is labeled with its path and viewport (phone 390px or desktop 1280px).',
    'Report visual problems only: overflow, overlap, clipped Hebrew text, broken layout, unreadable contrast, missing images.',
    'Do not suggest deploying to Wix.',
    'Reply in Hebrew with exactly these headings:',
    '## Blockers',
    '## Notes',
    'If a section is empty, write אין.',
    'Images:',
    ...images.map((image, index) => `${index + 1}. ${image.label}`),
  ].join('\n');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CHINESE_MODELS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      ...(extraFields === undefined ? { enable_thinking: false } : extraFields),
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...images.map((image) => ({
              type: 'image_url',
              image_url: { url: `data:${image.mime};base64,${image.base64}` },
            })),
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(180000),
  });
  const raw = await response.text();
  const redacted = redactSecrets(raw).slice(0, 500);
  if (!response.ok) {
    return { ok: false, status: response.status, error: `HTTP ${response.status}: ${redacted}`, body: raw };
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, status: response.status, error: 'Qwen returned non-JSON', body: raw };
  }
  const message = json.choices?.[0]?.message;
  const content = message?.content || message?.reasoning_content || '';
  if (!content) return { ok: false, status: response.status, error: 'Qwen returned an empty review', body: raw };
  return { ok: true, content: redactSecrets(content), model };
}

function classify(result) {
  const text = `${result.error || ''} ${result.body || ''}`.toLowerCase();
  const auth = result.status === 401 || result.status === 403 || text.includes('invalid_api_key') || text.includes('incorrect api key');
  const modelRejected = result.status === 404
    || text.includes('model_not_found')
    || text.includes('does not exist')
    || text.includes('does not support')
    || text.includes('image')
    || (text.includes('model') && (text.includes('not found') || text.includes('invalid')));
  return { auth, modelRejected };
}

async function reviewImages(images) {
  let lastError = 'no Qwen request was made';
  for (const endpoint of completionUrls()) {
    for (const model of MODELS) {
      let result = await callModel(endpoint, model, images);
      if (!result.ok && /enable_thinking|unknown parameter/i.test(result.error || '')) {
        result = await callModel(endpoint, model, images, {});
      }
      if (result.ok) return { ...result, endpoint };
      lastError = `${hostOf(endpoint)} ${model}: ${result.error}`;
      console.error(`Qwen attempt failed: ${lastError}`);
      const kind = classify(result);
      if (kind.auth) break;
      if (!kind.modelRejected) return { ok: false, error: lastError, endpoint };
    }
  }
  return { ok: false, error: lastError };
}

function commentBody({ selection, shots, review }) {
  const pageLine = selection.fallback
    ? `${selection.pages.join(', ')} (fallback — the diff did not name a page file)`
    : selection.pages.join(', ');
  const omitted = selection.omitted.length ? `\n- Not screenshotted (cap): ${selection.omitted.join(', ')}` : '';
  const shotLines = shots.map((shot) => {
    const name = shot.file ? shot.file.split('/').pop() : 'missing';
    const problem = shot.error ? ` — ${shot.error}` : '';
    return `- \`${name}\` ${shot.pageUrl} ${shot.viewport} HTTP ${shot.status || 'n/a'}${problem}`;
  });
  const findings = review?.content
    ? review.content
    : `The visual model did not return findings.\n\n${review?.error || 'Unknown error.'}`;
  return [
    MARKER,
    '## Qwen visual review (advisory)',
    '',
    '**Qwen findings must be verified by a human.** ממצאי Qwen דורשים אימות אנושי. This comment does not block the pull request.',
    '',
    `- Model: \`${review?.model || 'unavailable'}\``,
    `- Endpoint host: \`${review?.endpoint ? hostOf(review.endpoint) : 'n/a'}\``,
    `- Pages: ${pageLine}${omitted}`,
    '- Viewports: phone 390px, desktop 1280px',
    '- Screenshots artifact: `qwen-visual-screenshots` on this workflow run',
    '',
    '### Screenshots',
    ...shotLines,
    '',
    '### Findings',
    findings,
    '',
  ].join('\n');
}

export async function runQwenReview({ postComment = true } = {}) {
  if (!process.env.CHINESE_MODELS_API_KEY && !process.argv.includes('--screenshots-only')) {
    console.log('CHINESE_MODELS_API_KEY is not set. Skipping Qwen visual review.');
    return { skipped: true };
  }
  const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4321';
  const outDir = process.env.SCREENSHOT_DIR || '/tmp/astro-poc-screenshots';
  const selection = pagesTouchedByDiff(changedFiles());
  console.log(`screenshot pages: ${selection.pages.join(', ')}`);
  const shots = await captureScreenshots({ baseUrl, pages: selection.pages, outDir });
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ selection, shots }, null, 2));
  const images = imageContent(shots);
  if (process.argv.includes('--screenshots-only')) {
    console.log(`wrote ${shots.length} screenshots to ${outDir}`);
    return { skipped: false, screenshots: shots.length };
  }
  if (!process.env.CHINESE_MODELS_API_KEY) {
    console.log('CHINESE_MODELS_API_KEY is not set. Screenshots were saved. Skipping the model call.');
    return { skipped: true, screenshots: shots.length };
  }
  const batches = [];
  for (let i = 0; i < images.length; i += 4) batches.push(images.slice(i, i + 4));
  const parts = [];
  let review = { ok: false, error: batches.length ? 'no Qwen request was made' : 'no screenshots were captured' };
  for (const batch of batches) {
    review = await reviewImages(batch);
    if (!review.ok) break;
    parts.push(review.content);
  }
  if (parts.length > 0) {
    review = { ...review, content: [parts.join('\n\n'), review.ok ? '' : review.error].filter(Boolean).join('\n\n') };
  }

  const body = commentBody({ selection, shots, review });
  if (postComment && process.env.GITHUB_TOKEN && process.env.PR_NUMBER && process.env.GITHUB_REPOSITORY) {
    const result = await upsertPullRequestComment({
      token: process.env.GITHUB_TOKEN,
      repository: process.env.GITHUB_REPOSITORY,
      pullNumber: process.env.PR_NUMBER,
      marker: MARKER,
      body,
    });
    console.log(`Qwen comment ${result.action}`);
  }
  if (!review.ok) throw new Error(review.error || 'Qwen review failed');
  return { skipped: false, model: review.model, screenshots: shots.length };
}

const isMain = process.argv[1] && process.argv[1].endsWith('qwen-visual-review.mjs');
if (isMain) {
  runQwenReview({ postComment: !process.argv.includes('--screenshots-only') })
    .catch((error) => {
      console.error(redactSecrets(error instanceof Error ? error.message : 'Qwen review failed'));
      process.exit(1);
    });
}
