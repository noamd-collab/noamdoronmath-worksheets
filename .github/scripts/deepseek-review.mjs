/**
 * Advisory DeepSeek review of the pull request diff.
 * Skips when CHINESE_MODELS_API_KEY is missing. Never prints the key.
 *
 *   BASE_SHA=... GITHUB_TOKEN=... PR_NUMBER=... CHINESE_MODELS_API_KEY=... \
 *     node .github/scripts/deepseek-review.mjs
 */
import { execFileSync } from 'node:child_process';
import { upsertPullRequestComment } from './pr-comment.mjs';
import { redactSecrets } from './redact.mjs';

const MARKER = '<!-- astro-poc-deepseek-review -->';
const ENDPOINT = 'https://token-plan.maas.qwencloudapi.com/compatible-mode/v1/chat/completions';
const MODELS = ['deepseek-v4-pro'];
const DIFF_LIMIT = 100_000;

const SYSTEM = `You review a pull request diff for an Astro 5 site in headless/astro-poc.
The site is Hebrew, RTL, and a math worksheet catalog.
Do not suggest wix release, wix preview, wix deploy, or any publish step.
Reply in Hebrew.
Use exactly these two markdown headings, in this order:
## Blockers
## Notes
Under Blockers, list defects that would ship a broken page, a broken link, data loss, or a security issue.
Under Notes, list everything else worth a human look.
If a section has nothing, write "אין".
Do not repeat the diff and do not invent files that are not in it.`;

function pullRequestDiff() {
  const base = process.env.BASE_SHA;
  if (!base) throw new Error('BASE_SHA is missing');
  return execFileSync('git', ['diff', '--no-color', '--find-renames', base, 'HEAD'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

async function review(model, diff) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CHINESE_MODELS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: diff },
      ],
    }),
    signal: AbortSignal.timeout(120000),
  });
  const raw = await response.text();
  if (!response.ok) {
    const error = new Error(`DeepSeek HTTP ${response.status}: ${redactSecrets(raw).slice(0, 400)}`);
    error.status = response.status;
    error.body = raw;
    throw error;
  }
  const json = JSON.parse(raw);
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek returned an empty review');
  return content;
}

function modelRejected(error) {
  const text = `${error.message} ${error.body || ''}`.toLowerCase();
  return error.status === 400 || error.status === 404
    ? text.includes('model') || text.includes('not found') || text.includes('does not exist')
    : false;
}

export async function runDeepSeekReview({ postComment = true, diffText, dryRun = false } = {}) {
  if (dryRun) {
    const original = diffText ?? pullRequestDiff();
    return { dryRun: true, characters: original.length, truncated: original.length > DIFF_LIMIT };
  }
  if (!process.env.CHINESE_MODELS_API_KEY) {
    console.log('CHINESE_MODELS_API_KEY is not set. Skipping DeepSeek review.');
    return { skipped: true };
  }
  const original = diffText ?? pullRequestDiff();
  const truncated = original.length > DIFF_LIMIT;
  const diff = truncated
    ? `${original.slice(0, DIFF_LIMIT)}\n\n[diff truncated from ${original.length} characters]\n`
    : original;
  let findings = '';
  let modelUsed = '';
  let failure = '';
  for (const model of MODELS) {
    try {
      findings = redactSecrets(await review(model, diff));
      modelUsed = model;
      break;
    } catch (error) {
      failure = redactSecrets(error instanceof Error ? error.message : 'DeepSeek request failed');
      console.error(`DeepSeek model ${model} failed: ${failure}`);
      if (!modelRejected(error)) break;
    }
  }

  const body = [
    MARKER,
    '## DeepSeek code review (advisory)',
    '',
    'This comment does not block the pull request. Blockers are the model’s judgment, not a required check.',
    '',
    `- Model: \`${modelUsed || 'unavailable'}\``,
    `- Diff characters: ${original.length}${truncated ? ' (truncated before sending)' : ''}`,
    '',
    findings || `The review did not complete.\n\n${failure || 'Unknown error.'}`,
    '',
  ].join('\n');

  if (postComment && process.env.GITHUB_TOKEN && process.env.PR_NUMBER && process.env.GITHUB_REPOSITORY) {
    const result = await upsertPullRequestComment({
      token: process.env.GITHUB_TOKEN,
      repository: process.env.GITHUB_REPOSITORY,
      pullNumber: process.env.PR_NUMBER,
      marker: MARKER,
      body,
    });
    console.log(`DeepSeek comment ${result.action}`);
  } else if (postComment) {
    console.log('Pull request context is missing. Review was not posted.');
  }

  if (!modelUsed) {
    const error = new Error(failure || 'DeepSeek review failed');
    throw error;
  }
  return { skipped: false, model: modelUsed, truncated };
}

const isMain = process.argv[1] && process.argv[1].endsWith('deepseek-review.mjs');
if (isMain) {
  const dryRun = process.argv.includes('--dry-run');
  runDeepSeekReview({ postComment: !dryRun, dryRun })
    .then((result) => {
      if (dryRun) console.log(JSON.stringify(result));
    })
    .catch((error) => {
      console.error(redactSecrets(error instanceof Error ? error.message : 'DeepSeek review failed'));
      process.exit(1);
    });
}
