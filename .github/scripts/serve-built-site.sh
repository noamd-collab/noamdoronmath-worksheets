#!/usr/bin/env bash
# Start the already-built Node server and wait until it answers.
# Does not deploy. Listens on loopback only.
set -euo pipefail
cd "$(dirname "$0")/../../headless/astro-poc"
export HOST="${HOST:-127.0.0.1}"
export PORT="${PORT:-4321}"
if [[ ! -f ./dist/server/entry.mjs ]]; then
  echo "Missing dist/server/entry.mjs. Build the site before serving it."
  exit 1
fi
node ./dist/server/entry.mjs > /tmp/astro-server.log 2>&1 &
echo $! > /tmp/astro-server.pid
for _ in $(seq 1 60); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://${HOST}:${PORT}/" || true)"
  if [[ -n "$code" && "$code" != "000" ]]; then
    echo "Built site responded HTTP ${code} on ${HOST}:${PORT}"
    exit 0
  fi
  sleep 1
done
echo "Built site did not respond on ${HOST}:${PORT}"
tail -n 50 /tmp/astro-server.log || true
exit 1
