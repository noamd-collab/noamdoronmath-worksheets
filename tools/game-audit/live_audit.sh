#!/bin/bash
# Full manual browser audit of games that are ALREADY live, one directory per slug.
#
#   BASE=https://www.example.co.il TOOLS=~/work/tools APP=~/work/app \
#     live_audit.sh <slug> [<slug> ...]
#
# For each slug it runs, against the live URL <BASE>/<playPath>/:
#   1. shots-live.mjs  - screenshots at phone 390 and desktop 1280 for every step,
#                        layout checks, and the zero-pointer flow, into
#                        $TOOLS/shots-live/<slug>/ and $TOOLS/verify-live/<slug>.shots.txt
#   2. page_audit.mjs  - keyboard reachability and per-step problems, into
#                        $TOOLS/audit-live/<slug>.json
#   3. drag_probe.mjs  - drag still moves the handles, on scene steps 1, 3, 5, into
#                        $TOOLS/verify-live/<slug>.drag<N>.txt
#
# It never writes to the repository and never publishes anything.
set -u
rc=0
TOOLS="${TOOLS:?set TOOLS to the harness directory}"
APP="${APP:?set APP to the app dir that owns node_modules (puppeteer-core)}"
BASE="${BASE:?set BASE to the live origin, for example https://www.example.co.il}"
PLAY="${PLAY:-/games/%s/play}"          # printf pattern, %s = slug
STEPS="${STEPS:-9}"                      # number of steps to audit per game
DRAG_STEPS="${DRAG_STEPS:-1 3 5}"
A11Y="${A11Y:-$HOME/.manus/user-skills/drag-free-interaction-retrofit/scripts}"
export APP_DIR="$APP"   # shots-live.mjs resolves puppeteer-core from here
OUT="$TOOLS/verify-live"
mkdir -p "$OUT" "$TOOLS/audit-live" "$TOOLS/shots-live"
cd "$TOOLS" || exit 1
for s in "$@"; do
  url=$(printf "$BASE$PLAY" "$s")
  echo "=== $s  $url"
  script="$TOOLS/flows/$s.mjs"
  [ -f "$script" ] || script=""
  node "$TOOLS/shots-live.mjs" "$s" --steps=all ${script:+--script="$script"} \
    > "$OUT/$s.shots.txt" 2>&1
  st=$?; [ "$st" -eq 0 ] || rc=1
  echo "shots+flow exit $st : $(grep -Eo 'total [0-9]+' "$OUT/$s.shots.txt" | tail -1)"
  PUPPETEER_ROOT="$APP" node "$A11Y/page_audit.mjs" "$url" --vp=phone,desktop --steps="$STEPS" \
    --step-js='window.__lesson.goStep(i)' --quiet --json="$TOOLS/audit-live/$s.json" \
    > "$OUT/$s.audit.txt" 2>&1
  st=$?; [ "$st" -eq 0 ] || rc=1
  echo "audit exit $st"
  for st in $DRAG_STEPS; do
    PUPPETEER_ROOT="$APP" node "$A11Y/drag_probe.mjs" "$url" --before="window.__lesson.goStep($st)" \
      > "$OUT/$s.drag$st.txt" 2>&1
    d=$?; [ "$d" -eq 0 ] || rc=1
    echo "drag step$st exit $d : $(tail -1 "$OUT/$s.drag$st.txt")"
  done
done
echo
echo "summary: python3 $TOOLS/summarize_live.py --tools $TOOLS $*"
exit $rc
