# Explicit teaching limits for the private pilot

New web requests use `lesson.version: 2`. They retain the existing lesson fields
and require one closed `lessonBoundary` object matching the grade and topic:

```json
{"version":1,"kind":"division_facts","allowedDivisors":[2,3,5],"maxDividend":50}
```

This is only for grade 3 / `ג10`. Divisors are unique integers from 1 to 10;
maxDividend is an integer from 10 to 100. The API sorts the selected divisors.
The existing pilot still uses 12 questions and at least 3 parts per question.
Before authoring, require `sum(min(10, floor(maxDividend / divisor))) >= 9`:
the missing-divisor family needs nine different positive-quotient facts.
An impossible choice fails `BOUNDARY_TOO_NARROW` before a billed call.
Canonical validation checks every divisor and dividend after parameter
derivation; a model cannot override the limits with prose or correct answers.

```json
{"version":1,"kind":"linear_equations","allowSignedNumbers":false}
```

This is only for grade 7 / `g7:equations`. The boolean is mandatory. False means
no negative a, b, c or solution in canonical equations, and no negative values
in derived proposed answers, substitutions or challenge answers. The author
adapter must construct compatible nonnegative parameters rather than request
signed equations and reject every result. `validate_render_values` checks
trusted derived numbers before they enter markup. True permits signed values
within the existing canonical ranges; it does not authorize a new topic.

These choices are teacher declarations, not proof of learning. Free text is
context only and does not become an automatically interpreted hard constraint.
Minutes do not change the fixed pilot volume or prove classroom timing.

## Compatibility and rollout

The existing JSONB lesson column already accepts the object; no database
migration or authorization change is required. Old completed jobs remain
readable/downloadable without revalidating their old intake.

New API requests reject version 1. Queued version-1 jobs fail before any author
call with `LESSON_VERSION_REQUIRES_NEW_DRAFT`; they must not silently gain
invented teaching limits. Worker heartbeat capabilities include
`acceptedIntakeVersions: [2]`. Both status and enqueue require that declaration
as well as a fresh heartbeat. Publish the v2 web/API first: an old worker is
shown offline for creation while old history/downloads remain available.
After the reviewed new worker starts and advertises v2, new creation becomes
available. An old worker must not claim support for version 2.

Offline historical reproduction is an explicit exception:

```bash
python3 tools/teacher-generation/runner.py --lesson old-lesson.json --model-output old-canonical.json --out NEW_DIR --allow-legacy-intake
python3 tools/teacher-generation/benchmark.py --lesson old-lesson.json --out NEW_DIR --allow-legacy-intake
```

The benchmark remains dry-run unless separately passed `--call`. Python APIs
require `allow_legacy=True` explicitly. A version-1 lesson carrying a boundary
is rejected, because ignoring it would give a false impression of enforcement.
This escape hatch is not exposed by the website or remote worker.
