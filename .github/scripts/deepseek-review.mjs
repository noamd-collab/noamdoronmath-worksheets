/**
 * Advisory DeepSeek review of the pull request diff.
 * Skips when CHINESE_MODELS_API_KEY is missing. Never prints the key.
 *
 *   BASE_SHA=... GITHUB_TOKEN=... PR_NUMBER=... CHINESE_MODELS_API_KEY=... \
 *     node .github/scripts/deepseek-review.mjs
 */
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';
import { upsertPullRequestComment } from './pr-comment.mjs';
import { redactSecrets } from './redact.mjs';

const MARKER = '<!-- astro-poc-deepseek-review -->';
const ENDPOINT = 'https://token-plan.maas.qwencloudapi.com/compatible-mode/v1/chat/completions';
const MODELS = ['deepseek-v4-pro'];
const DIFF_LIMIT = 100_000;
const DIFF_ORDER = fileURLToPath(new URL('./deepseek-diff.order', import.meta.url));

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

export async function captureDiffStream(stream, { limit = DIFF_LIMIT } = {}) {
  const decoder = new StringDecoder('utf8');
  let prefix = '', characters = 0, bytes = 0;
  const consume = (text) => {
    characters += text.length;
    if (prefix.length < limit) prefix += text.slice(0, limit - prefix.length);
  };
  // Drain and count the entire diff, but never retain the generated payload.
  for await (const chunk of stream) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    bytes += buffer.length;
    consume(decoder.write(buffer));
  }
  consume(decoder.end());
  return { prefix, characters, bytes, truncated: characters > limit };
}

export async function pullRequestDiff({ base = process.env.BASE_SHA, cwd = process.cwd(), limit = DIFF_LIMIT } = {}) {
  if (!base) throw new Error('BASE_SHA is missing');
  // Order source/config code first; -O changes order, never the included paths.
  const child = spawn('git', ['diff', '--no-color', '--find-renames', '-O', DIFF_ORDER, base, 'HEAD'], {
    cwd, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    if (stderr.length < 8_000) stderr += chunk.toString('utf8').slice(0, 8_000 - stderr.length);
  });
  const completed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => code === 0
      ? resolve()
      : reject(new Error(`git diff exited ${code}: ${stderr}`)));
  });
  const [captured] = await Promise.all([captureDiffStream(child.stdout, { limit }), completed]);
  return { ...captured, order: 'code/config first; all changed paths included and counted' };
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
  const collect = () => diffText == null
    ? pullRequestDiff()
    : Promise.resolve({ prefix: diffText.slice(0, DIFF_LIMIT), characters: diffText.length,
      bytes: Buffer.byteLength(diffText), truncated: diffText.length > DIFF_LIMIT, order: 'caller-supplied diffText' });
  if (dryRun) {
    const captured = await collect();
    return { dryRun: true, characters: captured.characters, truncated: captured.truncated,
      retainedCharacters: captured.prefix.length, bytes: captured.bytes, order: captured.order };
  }
  if (!process.env.CHINESE_MODELS_API_KEY) {
    console.log('CHINESE_MODELS_API_KEY is not set. Skipping DeepSeek review.');
    return { skipped: true };
  }
  const captured = await collect();
  const truncated = captured.truncated;
  const diff = truncated
    ? `${captured.prefix}\n\n[diff truncated from ${captured.characters} characters; retained ${captured.prefix.length}; ${captured.order}]\n`
    : captured.prefix;
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
    `- Diff characters: ${captured.characters}${truncated ? ' (truncated before sending)' : ''}`,
    `- Retained characters: ${captured.prefix.length}; ${captured.order}.`,
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
