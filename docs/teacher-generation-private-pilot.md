# Private worksheet-generation pilot

Status recorded on 13 November 2026: source `680ae1f7` was published through the
guarded release workflow after PRs 457 and 458. The isolated database migration,
private bucket and worker are configured. Two owner-created drafts passed the
automated pipeline; two other attempts failed validation and delivered no files.
Noam reported that a manual PDF download succeeded. Earlier automated attempts
in the owner's Brave profile were blocked; their cause remains undiagnosed.

Microsoft Copilot Cowork independently reviewed the code and both draft pairs
and returned **REJECT**, despite confirming all 96 arithmetic answers. Confirmed
issues include repetitive parameters, uniformly `correct + 1` distractors and
the absence of enforcement of the free-text learning boundary. Copilot also
reported overlap in the middle-school DOCX in Word for the web; Codex reproduced
it independently in another browser. The corrected pilot DOCX was then checked
in actual Word for the web: the affected equations are readable and all parts of
answer 11 stay together on one page. LibreOffice rendering remains separate
evidence and cannot establish Word-web correctness.
The wizard and boundary/quality corrections in this checkout are under review;
they have not yet received external approval. This remains a private pilot.

## Access and scope

The existing teacher workspace remains available to signed-in Google users.
The new `/teachers/generate` page and `/api/teacherGeneration` endpoint use the
separate permanent owner entitlement in `src/lib/teacherAccessConfig.ts`: user
ID `80da2957-9492-4a9d-babb-28ba70dedd12`. Authentication is verified against the
fixed project's Auth endpoint; a matching email supplied by a browser is not an
entitlement. Anonymous sessions and other Google accounts cannot use this pilot.

The planning catalog covers 232 scoped topics across grades 1–9. Generation is
limited to the following entries in `tools/teacher-generation/capabilities.json`:

| Grade | Topic ID | Topic | Level | Main questions | Goals |
|---|---|---|---|---|---|
| 3 | `ג10` | Division and inverse multiplication | `b` | 12 | practice, review |
| 7 | `g7:equations` | First-degree equations | `b` | 20 | practice, review |

Both `enabled` and `e2eVerified` must be boolean `true`; the requested level and
question count must be explicitly listed. Disabled adapter candidates and the
planning catalog do not grant a generation capability. Introduction, assessment,
short sheets, advanced/excellence levels and other topics currently fail closed.
New requests use intake version 2 and an explicit `lessonBoundary`. The division
pilot records the divisors already taught and the maximum dividend; the equation
pilot records whether signed numbers have been taught. The server checks these
choices before enqueueing. The worker checks model parameters, canonical items
and trusted derived values before producing a document. A boundary too narrow
for the pilot's fixed number of distinct tasks is rejected before authoring.
Completed version-1 drafts remain readable; a new request cannot omit the new
boundary by submitting version 1. Explicit legacy reproduction is offline only.

Free-text teaching progress is authoring context, not a semantically enforced
rule, a verified calendar or evidence of prerequisite mastery. The requested
minutes do not automatically change the fixed pilot question counts. The UI must
state these limits. The catalog makes no verified official-month claim.

The intake is presented one step at a time: grade, topic, level, lesson boundary
and details, then review. Previous drafts are under a collapsed “הדפים שלי”.
The first steps do not request a model call; only the final explicit creation
action verifies CAPTCHA and submits a new job.

For the enabled grade-7 equation pilot only, a strict postprocessor creates a
separate Word-compatible DOCX. It converts the pinned emitter's simple linear
equation objects to editable, left-to-right mathematical text and keeps answer
parts together. It rejects complex math or unrecognized formatting instead of
silently simplifying them. The original skill output and its report are retained;
the PDF is unchanged. The final DOCX is checked again with the existing RTL gates,
and source/final hashes are recorded. This is not a general conversion for other
topics, fractions or structured mathematical objects. New drafts still require
teacher review.

## Components and pins

- Migration: `supabase/migrations/20261112185430_teacher_generation_private_pilot.sql`.
  It adds only `noam_teacher_generation_jobs`, `noam_teacher_generation_workers`,
  their functions/policies and a dedicated private Storage bucket. Existing
  learning, hints, worksheets and teacher material tables are not changed.
- Bucket: `teacher-generation-private`, never public; PDF/DOCX only, at most
  15,728,640 bytes per object. The owner may read only exact `owner/job/sheet.pdf`
  and `owner/job/sheet.docx` paths for a `needs_review` job whose check flag is
  JSON boolean `true`. Restrictive bucket boundaries also protect against older
  broad permissive Storage policies, while preserving other buckets' access.
- Database quota: at most one queued/running job and five created jobs in a
  rolling 24 hours. Failed jobs count. `(owner_id, request_key)` is unique; a
  changed request with the same key conflicts. Owner Data API access is read-only.
- Skills: elementary `1.0.5-noam` and middle `7.2.0-noam` (engine `6.18-noam`).
  `tools/teacher-generation/skill-lock.json` pins the files; modified, missing or
  extra Python files fail validation. Aggregate pin identifiers are
  `582ce27fd320b3714a248f2ef7adcfd9d96b0faf6644af7be7c78bb566418d5f`
  and `cbd46b144421db5260b3cb1142bc0e126c01335ce6fee8c32a24baf50e98a7bd`.
- The static curriculum is hash-pinned separately by
  `src/lib/teacherGenerationCurriculum.ts`; its JSON is not bundled into the
  size-limited Wix server worker.

The web API authorizes the owner, checks origin, validates input and advertised
capability, verifies CAPTCHA and then enqueues. It does not call a model. A
separately managed Python process makes outbound requests to claim work; it has
no inbound listener and the application does not install a daemon. The current
operator-configured macOS LaunchAgent requires an awake, logged-in Mac. One
claim gets one authoring attempt.
Leases last 20 minutes and are renewed while work proceeds. Expired running work
is marked failed on a later claim; it is not automatically retried against a paid
provider. A stale heartbeat is treated as offline after 90 seconds. The version-2
web API also requires the heartbeat to advertise `acceptedIntakeVersions: [2]`;
a fresh version-1 worker is intentionally shown as offline for new generation.
Existing completed drafts and their downloads do not depend on worker readiness.

## Setup, without applying production changes

Use a reviewed checkout and Python 3.12. Install the pinned packages in an
isolated environment and provide the native WeasyPrint/Pango dependencies:

```sh
python3.12 -m venv tools/teacher-generation/.venv
tools/teacher-generation/.venv/bin/python -m pip install -r tools/teacher-generation/requirements.txt
```

Use operator-managed environment configuration outside the repository. Required
names are `ELEMENTARY_SKILL_PATH`, `MIDDLE_SKILL_PATH`, `QWEN_BASE_URL`,
`QWEN_MODEL`, either `QWEN_API_KEY` or `DASHSCOPE_API_KEY`, and
`TEACHER_GENERATION_SERVICE_KEY`. Use the approved existing provider/model
configuration. No secret values belong in a lesson, log, artifact, PR or this
document. The env-file loader reads a fixed allowlist literally; it does not run
shell expressions. On macOS, native libraries may additionally need
`DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib` in the process environment.

After loading those variables into the process environment, the separate check is:

```sh
tools/teacher-generation/.venv/bin/python -B tools/teacher-generation/preflight.py --require-provider
```

This checks runtime/dependencies, skill pins and provider configuration; it does
not prove that provider credentials work, make a model request, publish a
heartbeat or claim a job. Never disable TLS verification to pass this check.

Wix adds one optional **server secret**, `TEACHER_GENERATION_SERVICE_KEY`, for
enqueueing after the API checks. It is a project service credential, not a public
key, and must never be sent to the browser. The existing
`NOAM_RECAPTCHA_SECRET_KEY` remains required for real submissions. With the new
enqueue secret absent, POST generation is unavailable; existing teacher access
does not depend on this secret.

## Version-2 update of the existing pilot

The database, bucket and server secrets already exist. This update requires no
new migration or broader access. Preserve the currently published worker checkout
while reviewing the replacement. Before switching workers, confirm there are no
queued or running jobs; do not interrupt an owner request or reset quota/history.
Stop the old worker, publish the reviewed site through the guarded source/pin PR
flow, then start the replacement from the exact frozen checkout. Check the queue
again before startup, runtime/skill pins, the version-2 heartbeat, and owner access.
The new site refuses to enqueue against the old worker during this transition.

Offline fixtures verify both equation boundaries and the division path without
spending a provider request. They are not evidence of a fresh live-model trial.
Preserve the owner's remaining trial instead of silently retrying failed work.

## Initial setup reference

1. Verify provider TLS and one genuine authored result through every
   required gate, with its lesson, pin versions and output hashes recorded
   privately. Inspect the complete PDF and actual Word rendering, including RTL,
   answer order and Hebrew. Keep `needs_review` distinct from publication approval.
2. Run the focused contract/API tests, Python worker/renderer tests and the local
   PostgreSQL security harness. Complete the repository's normal build/release
   checks. Local mock UI evidence is layout evidence only.
3. Review the exact migration and live Storage policy/configuration preflight.
   Apply the named migration only through the authorized database rollout; this
   document and the local tests do not apply or authorize it. Confirm the new
   tables, grants, RLS, function execution privileges and private bucket settings.
4. Configure the optional Wix server secret through the approved secret mechanism.
   Merge/publish only after the required approval for the specific PR, using
   `tools/release/release.sh`. Do not use a direct provider release command.
5. Start one reviewed worker in the foreground. The following is a template;
   replace the two operator paths locally, without pasting secret contents:

   ```sh
   tools/teacher-generation/.venv/bin/python -B tools/teacher-generation/remote_worker.py \
     --env-file /absolute/private/operator-approved.env \
     --work-dir /absolute/private/teacher-generation-jobs --once
   ```

   Startup readiness runs before the heartbeat and queue claim. `--once` checks
   the queue once and exits; omit it only when intentionally running the manual
   foreground loop. The work directory is set to mode 0700. No job/model field
   can choose a local output path or upload destination.
6. With the owner session, verify one allowed submission and private downloads.
   Verify that another Google account can still use the existing teacher area
   but receives denial for generation. Check quota/idempotency and that unfinished
   or failed artifacts cannot be read directly through Storage. Never mock or
   bypass CAPTCHA for these live checks.

## Pause and rollback

Stop the foreground worker first with Ctrl-C. Remove/disable the optional enqueue
secret through the approved server-secret mechanism to prevent new jobs. The
heartbeat will expire; stopping the worker does not itself erase queue rows or
private files. Do not restart it merely to clear an interrupted task: queued jobs
will otherwise become eligible for work, and a new owner request can spend again.

If the website behavior must be rolled back, prepare a new revert PR on the
current canonical branch so the replacement site commit remains a descendant of
the last live SHA. After Noam approves that exact revert PR and a new release-pin
PR, publish through the guarded repository release path. Never move the pin
directly to an older SHA: the production release guard rejects that history.
Keep the isolated tables and private bucket in place during rollback; no
destructive down migration, policy broadening, public-bucket conversion or reset
of existing teacher data is needed. A separately authorized operator may mark this pilot's queued/running
jobs failed after the worker has stopped. Preserve their IDs and audit evidence;
do not reset them to queued or reuse a consumed request key.

Before resuming, review remaining jobs and decide explicitly which requests to
cancel. Recheck runtime, pins, provider configuration and the exact release.
Publish a fresh heartbeat only by starting the reviewed worker. Deleting retained
artifacts or job history is a separate retention operation, not an automatic part
of rollback.

## Local UI review fixture

The ignored fixture under the workspace's
`work/teacher-ai-generation-20261112/ui-review/` is outside this repository. It
copies the page's main markup and generation CSS/JS, uses local fonts and a local
state API, and binds only to loopback port 4396. It has no credentials or remote
Auth/Storage/model access. It is visibly labeled as a simulation and cannot
produce a real worksheet. None of its simulated authentication/CAPTCHA behavior
is included in the shipped site. Full production layout/authentication review
must still use the actual page.
