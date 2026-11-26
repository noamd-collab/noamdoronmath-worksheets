# Bench harness for the teacher worksheet generator

Tools that measure whether "create a worksheet for a lesson" works, on recorded
model replies, on synthetic question forms and, with an explicit flag, on the
live model across the catalog. Nothing here is part of the worker image and
nothing here changes the engine.

| Tool | What it answers | Model calls |
| --- | --- | --- |
| `replay.py` | Of the recorded real replies, how many become a delivered sheet, and which question, field and substring stops each one? | none |
| `probes/run.py` | Which natural ways of writing a question does the engine accept, reject or print wrongly, and what changed since the recorded state? | none |
| `sweep.py` | Across catalog topics and levels, how often does the default teacher request deliver, by grade, domain and failure class, and at what cost? | only with `--live` |

Run from the repository root with the same `python3` as the engine's tests
(Python 3.12). On a Mac, export `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib`
if a PDF step cannot load its libraries.

```sh
python3 tools/teacher-generation/bench/replay.py --out /tmp/replay-1
python3 tools/teacher-generation/bench/replay.py --out /tmp/replay-2 \
    --compare tools/teacher-generation/bench/corpus/baseline/results.json
python3 tools/teacher-generation/bench/probes/run.py
python3 tools/teacher-generation/bench/sweep.py --dry-run --one-level-per-topic
```

The pinned skills are unpacked from the archives that ship with the engine
(`cloud/container/skills`) into the tool's work folder, unless
`ELEMENTARY_SKILL_PATH` and `MIDDLE_SKILL_PATH` are both set.

## How the engine is driven

`engine.py` is the only module that reaches into the engine.

- A job runs through `remote_worker.process_job`, unchanged. That function
  calls `author_and_render` and applies the worker's own acceptance and upload
  checks, so "delivered" here is the worker's decision, not a copy of it.
  Replaced: `update_job`, `check_transport`, `heartbeat`, the remote object
  (uploads are accepted in memory) and `provider.request_author_json`.
  Wrapped to observe only: `author_lesson`, `render_job`, `precheck_job` and
  `author_and_render`, whose `summary` argument is the repair ladder's own
  record (attempts, corrections, replaced and dropped questions).
- A single reply goes through `general_provider.author_general_lesson` (the
  compile path) with the transport replaced, and the printed pupil text and
  key come from `general_adapters.compile_source`, the call the render's first
  step makes.
- Offline tools refuse every outbound socket and report the number of
  attempts; real credentials are removed from the process environment for the
  duration of the run.

When a lesson is one the engine writes itself (a local author, no model call),
`replay.py` sends it to the general author instead so the recorded reply is
actually examined; the result says `route: general` and names the local author.

## Question-level failures

`isolate.py` finds the failing question, field and substring without parsing
any notation. It sends reduced replies through the real compile path: the
question alone on a four-question sheet under a neutral title and rule, then
each item, the intro, the table or the figure alone, then each `[[...]]` island
or run of prose alone. A fragment is named only when it brings the same code
back on its own. If the neutral sheet itself is rejected the tool says so
instead of attributing failures.

## Results

- `replay.py` writes `results.json` and `summary.md` (identical for identical
  engine behaviour: no timings, paths or file hashes) and `run.json` (timings,
  work folders, delivered files, machine facts).
- `--corrections` chooses how recorded correction replies answer: `exact`
  (default) only a request for exactly the recorded keys; `subset` also a
  request for some of them, with those questions (a what-if: the live request
  would have named fewer questions); `none` answers no correction, so only
  reserves, and a shorter sheet when the request is above its grade minimum
  (8 / 12 / 14 / 20 questions in grades 1–2 / 3–4 / 5–6 / 7–9), can save a
  case. 25 of the 35 corpus cases ask for 20 questions in grades 7–9, the
  minimum, so no shorter sheet exists for them. A correction kept as text
  (`format: "text"` in the index) goes through the engine's own reply reader.
- `needs_unrecorded_reply` means the repair ladder ended without a sheet and
  the engine asked for a second full author reply that was never recorded. The
  replay stops there; it never invents a reply. A correction that was never
  recorded does not stop a job: it counts as a failed correction, the ladder
  goes on (to a shorter sheet only when the request is above its grade
  minimum), and `ladder.correctionFailed` records it. In `summary.md` the
  column "Correction asked" counts the questions asked for again and adds
  `rule` when the refused rule was asked for too (`rule` alone when no
  question was).
- Each case carries `ladder`: the worker's attempts and corrections, the
  questions replaced and dropped, and per author attempt the selection events
  (question, group, codes, stage, action). No worksheet text.
- A local render may check less than the worker image: without poppler the
  elementary page-fill check is deferred with a warning, and without tesseract
  the middle-school figure reader cannot run. Each render lists its skipped
  checks, and the summary names the missing tools.

## The live sweep

`sweep.py` refuses to start without `--live`, `--max-calls` and
`--max-output-tokens`. The provider settings are read from the environment
only, through the engine's own `provider.author_config`: `QWEN_API_KEY` or
`DASHSCOPE_API_KEY`, `QWEN_BASE_URL` and `QWEN_MODEL`, or
`TEACHER_AUTHOR_PROVIDER=gemini` with `GEMINI_API_KEY`. The key is never
written, printed or put on a command line, and logs are scrubbed of credential
values before they are saved. The cost estimate exists for the one Qwen model
with a verified price; another model reports `MODEL_PRICE_NOT_VERIFIED`. The
Gemini path of the sweep has run with a stand-in transport only.

The offline tools (`replay.py`, `probes/run.py`) remove every provider
variable, the author switch included, and use placeholder Qwen settings.

- Each case is the request of a teacher who changes nothing (see
  `lessons.py`) and runs in its own process, as production runs one job per
  process, with the worker's 300-second call timeout.
- A case may connect only to the provider host (`--allow-host` adds a proxy).
- Budget: every running case holds a reservation of calls and output tokens,
  and a call that would exceed it is refused before any network use. A call
  that returns no token count is charged its own `max_tokens`.
- Rerunning with the same `--out` skips finished cases. A case the budget cut
  short is not recorded as a result and runs again.
- `--only-failed <folder>` selects the cases an earlier sweep did not deliver.

## After an engine change

1. Run the unit tests. `test_bench_probes.py` fails if any probe prints a
   wrong key, an answer beside its question or an exercise it should not show.
2. Run `probes/run.py`, read the change report, and record the new state with
   `--update` once it is what you intended. `--update` records nothing while
   any probe prints wrongly: make the engine refuse that form.
3. Run `replay.py --compare bench/corpus/baseline/results.json` and replace the
   baseline when the change is deliberate.

If the engine's entry points are renamed, or the reply gains a group that the
recorded replies do not have, adjust `engine.py`; the other bench modules do
not import the engine's pipeline.

## Tests

`tests/test_bench_replay.py`, `tests/test_bench_probes.py` and
`tests/test_bench_sweep.py` run with the engine's suite and never use the
network. The skill render is exercised only with `BENCH_RENDER_TESTS=1`,
because it is slow and needs the local render stack.
