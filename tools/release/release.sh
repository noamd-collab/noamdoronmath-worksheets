#!/usr/bin/env bash
# Build + publish the Astro site to Wix from a given commit.
# Usage: tools/release/release.sh <expected-commit-sha> [repo-dir]
# Env (see tools/.env.example): WIX_CLI_API_KEY (optional, for non-interactive login), NODE_BIN, RELEASE_BRANCH (default: main)
set -u
[ -f "$(dirname "$0")/../.env" ] && set -a && . "$(dirname "$0")/../.env" && set +a
EXPECT="${1:?expected commit sha}"; REPO="${2:-$(git rev-parse --show-toplevel)}"
BRANCH="${RELEASE_BRANCH:-main}"
[ -n "${NODE_BIN:-}" ] && export PATH="$NODE_BIN:$PATH"
cd "$REPO" || exit 1
git fetch origin "$BRANCH" && git checkout --detach "$EXPECT" || exit 2
git merge-base --is-ancestor "$EXPECT" "origin/$BRANCH" || { echo "commit not on $BRANCH"; exit 3; }
cd headless/astro-poc || exit 4
W="env -u CURSOR_AGENT -u CURSOR_TRACE_ID -u AI_AGENT"
[ -n "${WIX_CLI_API_KEY:-}" ] && $W npx wix login --api-key "$WIX_CLI_API_KEY" </dev/null
$W npm ci --no-audit --no-fund || exit 6
$W npm run build </dev/null || exit 7
CI=1 $W npx wix release </dev/null; echo "RELEASE_EXIT=$?"
