#!/usr/bin/env bash
# Local Node-adapter build of headless/astro-poc.
# This is the CI build. It does not call `wix build`, `wix preview`, or `wix release`.
set -euo pipefail
export ASTRO_TELEMETRY_DISABLED=1
cd "$(dirname "$0")/../../headless/astro-poc"
npx tsx scripts/build-site-guide.ts
npx astro build --config astro.config.preview.mjs
