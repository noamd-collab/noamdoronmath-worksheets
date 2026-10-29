#!/usr/bin/env bash
# Build + publish the Astro site to Wix from a given commit.
# Usage: tools/release/release.sh <expected-commit-sha> [repo-dir]
# Env (see tools/.env.example): WIX_CLI_API_KEY (optional, for non-interactive login), NODE_BIN, RELEASE_BRANCH (default: headless/astro-poc-baseline until the main switch merges)
set -u
[ -f "$(dirname "$0")/../.env" ] && set -a && . "$(dirname "$0")/../.env" && set +a
EXPECT="${1:?expected commit sha}"; REPO="${2:-$(git rev-parse --show-toplevel)}"
BRANCH="${RELEASE_BRANCH:-headless/astro-poc-baseline}"
[ -n "${NODE_BIN:-}" ] && export PATH="$NODE_BIN:$PATH"
cd "$REPO" || exit 1
git fetch origin "$BRANCH" && git checkout --detach "$EXPECT" || exit 2
git merge-base --is-ancestor "$EXPECT" "origin/$BRANCH" || { echo "commit not on $BRANCH"; exit 3; }
cd headless/astro-poc || exit 4
W="env -u CURSOR_AGENT -u CURSOR_TRACE_ID -u AI_AGENT"
# The wix executable comes from @wix/cli. Install before login, or npx exits
# with "could not determine executable to run" (release.sh exit 5).
$W npm ci --no-audit --no-fund || exit 6
# wix login --api-key works without a TTY. wix release does not: with no TTY, Ink
# throws NonInteractiveTerminal before it uploads anything. A PTY lets a logged-in
# headless release finish. Headless release publishes as soon as the preview exists.
run_release() {
  if [ -t 0 ]; then
    CI=1 $W npx wix release
  else
    script -qefc 'env -u CURSOR_AGENT -u CURSOR_TRACE_ID -u AI_AGENT CI=1 npx wix release' /dev/null
  fi
}
if [ -n "${WIX_CLI_API_KEY:-}" ]; then
  $W npx wix login --api-key "$WIX_CLI_API_KEY" </dev/null || exit 5
fi
# @wix/astro reads WIX_CLIENT_ID from .env.local. Login does not write that file.
if [ ! -f .env.local ]; then
  echo "No .env.local. Pulling Wix env so the build can read WIX_CLIENT_ID."
  $W npx wix env pull --json </dev/null || exit 8
fi
$W npm run build </dev/null || exit 7
release_rc=0
run_release || release_rc=$?
echo "RELEASE_EXIT=$release_rc"
exit "$release_rc"
