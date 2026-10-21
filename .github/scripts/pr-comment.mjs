/**
 * Create or replace one pull-request comment identified by an HTML marker.
 * The marker stays in the body so a later push updates the same comment.
 */

export async function upsertPullRequestComment({
  token,
  repository,
  pullNumber,
  marker,
  body,
}) {
  if (!token) throw new Error('GITHUB_TOKEN is missing');
  if (!repository || !String(repository).includes('/')) {
    throw new Error('GITHUB_REPOSITORY is missing');
  }
  if (!pullNumber) throw new Error('pull request number is missing');
  if (!marker || !body.includes(marker)) {
    throw new Error('comment body must include its marker');
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'astro-poc-pr-checks',
    'Content-Type': 'application/json',
  };
  const listUrl = `https://api.github.com/repos/${repository}/issues/${pullNumber}/comments`;
  let existing = null;
  for (let page = 1; page <= 10 && !existing; page += 1) {
    const res = await fetch(`${listUrl}?per_page=100&page=${page}`, { headers });
    if (!res.ok) throw new Error(`listing PR comments failed: HTTP ${res.status}`);
    const comments = await res.json();
    if (!Array.isArray(comments) || comments.length === 0) break;
    existing = comments.find((comment) => typeof comment.body === 'string' && comment.body.includes(marker)) ?? null;
    if (comments.length < 100) break;
  }

  const payload = JSON.stringify({ body: body.slice(0, 65000) });
  if (existing?.url) {
    const res = await fetch(existing.url, { method: 'PATCH', headers, body: payload });
    if (!res.ok) throw new Error(`updating PR comment failed: HTTP ${res.status}`);
    return { action: 'updated', id: existing.id };
  }
  const res = await fetch(listUrl, { method: 'POST', headers, body: payload });
  if (!res.ok) throw new Error(`creating PR comment failed: HTTP ${res.status}`);
  const created = await res.json();
  return { action: 'created', id: created.id };
}
