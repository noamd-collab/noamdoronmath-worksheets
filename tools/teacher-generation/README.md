# Private skill worksheet runner

This is a real offline PDF and editable Word renderer using the installed,
hash-pinned Hebrew worksheet skills. Model responses are closed JSON data.
The worker never accepts model-authored Python, HTML, SVG, file paths, URLs,
gate flags, approvals or output filenames.

## Current supported pilot

`capabilities.json` is the runtime allowlist, separate from the full curriculum
intake catalog. Only `enabled: true` rows may reach authoring/rendering:

| Grade | Exact topic | Level | Goals | Questions |
|---|---|---|---|---|
| 3 | `ג10` — division and inverse multiplication | `b` | practice, review | 12 |
| 7 | `g7:equations` — first-degree equations | `b` | practice, review | 20 |

The two committed fixtures have passed the full applicable blocking pipeline
(summarized in `pilot-evidence.json`; private local files are in ignored
`local-output/venv-elementary` and `local-output/venv-middle`).
That is evidence for those exact fixture outputs, not all possible author data.
Other rows are **disabled adapter candidates**, not supported topics. Grades
1–9 are the product scope; this pilot does not claim full scope delivery.

Advanced/excellence require distinct multi-step/open constraint task families.
They currently return `UNSUPPORTED_LEVEL`, rather than relabeling a basic
worksheet. Challenges must change the task structure; plain calculation/solve
items cannot be starred. Assessment requires a separate student file and key;
introduction, short sheets, geometry, decimals and free-form stories are not
implemented. Unknown topics/progress boundaries fail closed. There is no
automatic topic or level fallback.

## Contract

```python
from runner import render_job
manifest = render_job(lesson, model_payload, new_empty_job_directory,
                      skill_paths={"elementary": elementary_path,
                                   "middle": middle_path})
```

Add this directory to the trusted Python module search path when embedding it.
The process must start with a trusted working directory and runtime. Paths are
operator configuration, never request/model fields. `render_job` does not call
the provider or access the database/network queue. It performs validation,
verifies all skill file hashes, then executes fixed adapters and skill tools
in subprocesses. Each job must have its own empty directory.

Intake v1: `gradeNumber`, `topicId`, `level`, `lessonGoal`, `lastLesson`,
`alreadyLearned`, `minutes`, `questionCount`, optional `classLabel`,
`taughtThroughTopicId`, `explicitShortSheet`. The web intake validates the
complete curriculum selection. This runner additionally checks its narrow
capability and the requested volume. In this pilot the taught-through topic
must equal the chosen topic. Free-text progress informs authoring; it is not
an independently verified knowledge map or permission to introduce concepts.

The output structure is documented in `model-output.schema.json`; the
authoritative semantic validator is `validation.py`. Arithmetic uses bounded
integers (candidate fraction support uses reduced numerator/denominator
objects), operation enums and exact results. First-degree equations use
`a`, `b`, `c`, `solution`; Python independently checks substitution. No `eval`,
model code, general symbolic parser or model-provided markup is used.

Return manifest:

- `status: needs_review | failed`.
- `automatedChecksPassed` is true only when all runner steps passed and both
  expected final artifacts exist. `artifacts` is empty after any blocking
  failure. Each successful artifact includes a relative path, byte size and
  SHA-256.
- `review` always retains mathematical/pedagogical, visual and curriculum
  limits. A successful process is not human approval or publication approval.
- `steps` records every invoked gate with a relative log path. Logs stay
  private. Only the PDF and DOCX are eligible for owner download, never the
  entire directory/private keys/source/logs.

`GenerationError.code` exposes bounded error categories such as
`UNSUPPORTED_TOPIC`, `UNSUPPORTED_LEVEL`, `UNSUPPORTED_GOAL`,
`WRONG_ANSWER`, `SKILL_HASH_MISMATCH`, `OUTPUT_EXISTS`. It is safe to map these
to product messages; do not expose raw subprocess logs to the browser.

## Reproducible local use

Use Python 3.12 and the packages in `requirements.txt`, with the native
WeasyPrint/Pango libraries available. An isolated local runtime is installed
at `tools/teacher-generation/.venv` (ignored by git); its preflight imports and
exact dependency versions passed. This is not a deployed service/container
image or a proof of Linux portability.

Set `ELEMENTARY_SKILL_PATH` and `MIDDLE_SKILL_PATH` to the deployed skill
directories. No developer home path is embedded in the implementation.
`skill-lock.json` pins all installed files of elementary **1.0.5-noam** and
middle **7.2.0-noam**, whose engine is **6.18-noam**. Extra Python source,
missing/modified pinned files, and symlinked pinned files are rejected.
Changing the deployed skill is a reviewed lock update, not an automatic
download or an owner request parameter.

Before any heartbeat/job claim, load operator-approved environment variables
and run `tools/teacher-generation/.venv/bin/python -B
tools/teacher-generation/preflight.py --require-provider`. On macOS the native
libraries may require `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib`.
This command checks Python/dependency versions, every pinned skill file and
the provider configuration shape, without a model request or heartbeat. It
prints no credential values. Omit `--require-provider` for an offline-only
renderer check; `provider.configured=false` then explicitly remains visible.

```sh
python3 -m unittest discover -s tools/teacher-generation/tests -v
python3 tools/teacher-generation/runner.py \
  --lesson tools/teacher-generation/examples/elementary-lesson.json \
  --model-output tools/teacher-generation/examples/elementary-model.json \
  --out tools/teacher-generation/local-output/elementary
python3 tools/teacher-generation/runner.py \
  --lesson tools/teacher-generation/examples/middle-lesson.json \
  --model-output tools/teacher-generation/examples/middle-model.json \
  --out tools/teacher-generation/local-output/middle
```

Commands fail if their output directory is nonempty. Keep the source lesson,
typed model data, generated canonical `worksheet-source.json`, and manifest.
Rebuild through this runner plus the pinned skills, not by assuming an engine's
copied `source/content.py` is the complete standalone package.

Elementary: trusted adapter → exact answer ledger → content truth →
`build_pdf.py` → `build_docx.py` → `check_worksheet.py` → strict output gates →
`house_gates.py` G50–G70, including content, chronology, drawings, Word RTL and
answer layout. No diagrams are emitted.

Middle: trusted fixed `content.py` loads data in `levels.json` →
`build_v72.py --pkg JOB` → unchanged `build_plus.py` → four independent
checkers → DOCX from the same IR → Word RTL/parity gates. All strict defaults
remain on. This is a full broad worksheet, without `SHEET`: section-specific
G85–G92 and catalog/landing steps explicitly report **SKIP (legacy)**, never
PASS. It is not the new subtopic-sectioned pipeline. Native `wspec/1` JSON
exists in the skill, but its geometry-centric schema is not substituted for
the native algebra builder by pretending unsupported constraints exist.

Every PDF page still needs visual review, and every Word file needs an actual
Word rendering review. The Word XML checks confirm editable text/equations,
not Word's final pagination. macOS Vision OCR and Word.app are required for
the existing geometry/Word visual routes; neither has been ported to Linux.
Installed middle-skill release metadata still says draft/unapproved, and its
subtopic curriculum records remain draft pending official-source verification.
This renderer does not upgrade that provenance or promise official monthly
curriculum alignment.

## Qwen authoring and hosting boundary

`provider.author_lesson(lesson, ...)` performs one **billed authoring** request
only when explicitly called by the authenticated, quota-controlled worker.
It uses the existing `QWEN_API_KEY` (or `DASHSCOPE_API_KEY`), `QWEN_BASE_URL`
and `QWEN_MODEL` configuration; it does not choose a new provider/model or use
Qwen for review. Hosts/path match the site's `qwenChatUrlFrom` allowlist;
redirects are disabled. HTTPS uses the pinned `certifi` CA bundle with
certificate/hostname verification enabled. Structured JSON authoring sends
`enable_thinking: false`, as the existing site companion does, and a strict
per-lesson parameter schema with exact question count, item count bounds,
closed objects and numeric bounds. A trusted `questionPlan`
derives each question's kind and challenge flag from `requiredKindCounts`:
three structural challenges for elementary, two for middle, never ordinary
calculation/solve questions. The author must not supply `kind` or `star`.
Supported `prefixItems` constraints fix each position's parameter schema;
local `$defs` references avoid repeating large item definitions.

The **author-only v2 contract** is
`{"version":2,"questions":[{"items":[...]}]}`. Each question has 3–6 items:

- Grade 3 division: `{"divisor":3,"quotient":4}`. Divisor is 1–10; quotient
  is 0–10, or 1–10 in a missing-divisor position to keep its solution unique.
  Trusted code constructs `left = divisor × quotient`, `right = divisor` and
  `answer = quotient`, with operation fixed to division.
- Grade 7 equations: `{"a":2,"b":3,"solution":4}`. Bounds are a 1–12,
  b −100..100 and solution −20..20. Trusted code constructs
  `c = a × solution + b` for `a × x + b = c`; c outside −250..250 is rejected.
  Here solution is a design parameter for a newly constructed equation, not
  the model's claimed solution to a pre-existing equation.

The complete raw object is checked for exact shape, types and bounds before
any derivation. Extra `answer`, `c`, `kind`, `star` or other fields fail closed.
Canonical renderer v1 remains unchanged. All its math, duplicates, volume,
task-balance and layout gates still run; no missing items are filled in and
no failed output is retried. This is explicit construction from parameters,
not repair of an incorrect answer that the model asserted. The model selects
parameters in the teacher's learned-topic context; that context is not itself
an independently verified knowledge map.
The provider's documented
[structured output support](https://www.alibabacloud.com/help/en/model-studio/qwen-structured-output)
includes Qwen3.8-Flash. Semantic validation still independently checks answers,
task balance, stars and duplicate items. `{"version":2,"questions":[]}` is the
schema-compatible inability response; it fails closed as `AUTHOR_UNSUPPORTED`,
never a short worksheet. The 14,000 output-token limit remains bounded.
Provider bodies, headers and credentials are never
logged. Truncated/invalid/unsupported model output is rejected, with no
automatic billed retry. These implementation tests made **no provider calls**.

An optional `metadata={}` argument is filled with requested/returned model,
elapsed seconds, bounded token-usage counts and validation status; the function
returns only validated canonical v1 data. Metadata also records
`authorContract: worksheet-parameters/2` and `derivation` (canonical version,
fixed construction rule and whether construction completed). Usage is retained when a response is
truncated or fails validation, because a failed output can still incur cost.
`validationError` contains only the local validator's fixed code/message; it
never contains HTTP bodies or model-provided values. No currency cost is
guessed by this module; the operator applies the verified provider/model price.

## One-attempt authoring benchmark

`benchmark.py` is a separate operator tool, not the queue worker. Default use
checks the pinned runtime, skills and lesson without a provider call:

```sh
tools/teacher-generation/.venv/bin/python -B tools/teacher-generation/benchmark.py \
  --lesson tools/teacher-generation/examples/elementary-lesson.json \
  --out tools/teacher-generation/local-output/new-dry-run
```

Only adding **`--call`** performs one billed authoring attempt and then the
full applicable offline render/gate pipeline. Load the approved provider/skill
environment first. No model override, database, heartbeat, upload, publication
or Qwen review is involved. Every invocation requires a **new directory**,
including dry runs. Existing directories are rejected even if empty. A marker
is written before authoring, and neither a failure nor interruption triggers
a retry. To measure another explicit attempt, choose a new output directory.

`benchmark-report.json` retains model, token counts, elapsed times, gate
statuses and safe errors even after failure; artifacts appear only after all
blocking gates and both expected formats pass. `render/manifest.json` and
private logs retain rendering details. Missing usage is unknown cost, not zero.
The measured dry run in `local-output/benchmark-dry-run-20261112` passed its
locked preflight with **zero authoring attempts**. The 53 unit tests include
mocked one-attempt/failure/cost/no-overwrite checks; they made no provider calls.

For `qwen3.8-flash` only, the report estimates author API cost using the
[official Frankfurt list prices](https://www.alibabacloud.com/help/en/model-studio/model-pricing),
checked 2026-11-12: Global input/output $0.113/$0.382 per million tokens, EU
$0.15/$0.47. It reports both scenarios because a regional hostname does not
establish deployment scope. Cache/promotional/tax adjustments and rendering,
hosting, storage and human review are excluded. The estimate is not an invoice.

Compare total cost **including failed attempts** against independently accepted
worksheets, not token price alone. PDF plus editable Word count as one worksheet.
The report separates automated gate success from human acceptance, which stays
pending. Cost per accepted worksheet is undefined when none was accepted. A
single sample is not a reliability estimate or evidence of broad topic quality.

Live provider status before the parameter-contract v2 trial (all
Qwen3.8-Flash, authoring only):

| Trial | Result | Input/output tokens | Author seconds |
|---|---|---|---|
| Elementary, initial JSON object | `INVALID_MODEL_OUTPUT`, specific cause unknown because detail was not retained | 695 / 1,733 | 164.210 |
| Elementary, generic strict schema | `UNSUPPORTED_CHALLENGE`: calculation question labeled as a challenge | 776 / 762 | 159.912 |
| Middle, generic strict schema | `UNSUPPORTED_CHALLENGE`: ordinary solve question labeled as a challenge | 737 / 2,900 | 174.755 |
| Elementary, fixed question plan | `WRONG_ANSWER`: rejected by the independent arithmetic check; specific raw item was not retained | 930 / 758 | 160.510 |
| Middle, fixed question plan | `DUPLICATE_ITEM`: rejected by the independent duplicate-task check | 977 / 1,241 | 170.560 |

All five failures remain failures; they were not repaired or counted as
accepted worksheets. They motivated a separate **architecture trial** with
parameter construction. The coordinator's two v2 calls both passed the
unchanged canonical validation and complete applicable render/gate pipeline:

| v2 author trial | Input/output tokens | Author seconds | Initial complete run seconds | Estimated author API USD |
|---|---|---|---|---|
| Grade 3 division | 870 / 408 | 158.886 | 161.410 | 0.000254166–0.000322260 |
| Grade 7 first-degree equations | 929 / 2,103 | 173.382 | 180.123 | 0.000908323–0.001127760 |

Original measurements remain unchanged in
`local-output/live-parameters-elementary-20261112/benchmark-report.json` and
`local-output/live-parameters-middle-20261112/benchmark-report.json`.
These runs demonstrate the parameter-selection-plus-builder architecture;
they do not demonstrate Qwen's independent arithmetic ability or establish a
reliability rate from two samples. Including the five failed development
responses, reported API token usage totals an estimated $0.004451992–$0.005542450.
The five earlier calls used different contracts, so 2/7 is not a measured
production success rate. Human-accepted cost remains undefined pending review.

Visual/pedagogical review found that a star merely repeated an earlier task
structure. Trusted adapter changes now add a multiplication check in elementary
starred questions. Middle starred construction asks for the new left-hand side
when x increases by one and an explanation of the change; starred error checking
also asks for a right-hand side that makes the proposed value a solution.
Answer keys include these additional results and starred items get more writing
space. A first middle refinement spilled its last answer onto a nearly empty
ninth page; concise equivalent answer wording removed that extra page.

The **November 12 offline refinements** reused the exact validated canonical data,
made **zero additional model calls**, and passed all applicable gates:

- `local-output/live-parameters-elementary-release-20261112/manifest.json`
  records the final four-page PDF and editable Word pair. The coordinator
  reviewed all PDF pages; final PDF bytes match the reviewed refined output.
- `local-output/live-parameters-middle-final-20261112/manifest.json`
  records the final eight-page PDF and editable Word pair. An independent
  Codex subagent reviewed every PDF page, including answers, Hebrew/RTL,
  negative numbers, part order, writing space and page fill. Pages 1–5 match
  the reviewed original PNGs exactly; pages 6–7 match the reviewed refined
  bodies with only the footer page count changed; the final answer page was
  inspected again. All 60 base solutions and 21 deliberately wrong proposed
  values were independently checked, plus the six extra challenge results.

The **November 13 release samples** retain those exact PDF bytes and canonical
inputs, with zero additional model calls:

- `local-output/release-elementary-final-20261113/manifest.json`: all eight
  automated steps passed. Its three-page Word export keeps each question
  together and uses nonbreaking spaces inside the skill's isolated math runs.
  This fixes question 9 splitting across pages and two answer equations
  breaking immediately before their results. Every final rendered page was
  inspected with the bundled LibreOffice renderer. Word uses its own page
  metrics; forced four-question pages were rejected because they left an
  unnecessarily sparse page.
- `local-output/release-middle-docx-20261113/manifest.json`: all applicable
  gates passed. All eight final Word page PNGs are byte-identical to the eight
  individually inspected pages; only core document metadata changed.

Current hashes, page-image hashes and the original failure evidence are in
`pilot-evidence.json` under `wordLayoutRelease`. The new `word-layout` step
runs before the elementary output gates, fails closed for an unexpected
question structure, and records its helper hash in the manifest. Four focused
regression tests and the complete 61-test Python suite passed. Installed skills
remain pinned and unchanged. Historical benchmark reports and all seven calls'
usage/cost records were preserved.

The grade 7
sample stays within the declared first-degree equations, substitution and
signed-number scope. Its 60 parts have not been classroom-timed for the requested
45 minutes, and exact taught-through progression remains a teacher judgment.
**LibreOffice visual review passed; actual Microsoft Word application review
is still BLOCKED** by the computer-use server timeout. These are separate
checks. Neither sample is human-approved for public catalog delivery; the
owner pilot still leaves worksheet acceptance to the teacher.

## Hosting boundary

The existing Wix Worker cannot run this Python/native rendering stack. A
separate authenticated runner must lease a durable owner-only job, call the
author once, render in an isolated directory, and privately upload the two
verified artifacts. Queue, leases, authorization, storage and quotas are the
transport's responsibility. Every status/download lookup must reauthorize the
owner; general teacher Google access must not grant AI generation access.
No runner service has been installed or started by this module, no DB change
is implied, and nothing is automatically added to the public catalog/site.

See [worker-operations.md](worker-operations.md) for the separate operator
preflight, private credential requirements, truthful heartbeat behavior and
reviewable macOS LaunchAgent start/stop commands. `remote_worker.py --check-only`
never claims a job, writes a heartbeat or calls the paid author. The normal
worker only advertises health after runtime, private storage, queue schema and
an actual claim RPC have succeeded. Local Mac operation remains dependent on
the user session and an awake machine.
