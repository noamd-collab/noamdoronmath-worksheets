# Teacher generation on Cloudflare

This service runs the existing Python renderer in a Linux container. The website,
Google sign-in, owner-only generation, CAPTCHA, quota, private Supabase queue and
artifact downloads keep their current contracts. Cloudflare does not host the
website or replace Supabase. A live release needs its own cutover receipt;
committing this directory does not migrate the Mac worker.

## Runtime

A Cron Trigger calls one fixed Durable Object (`primary`) every minute. The
object starts one `standard-1` container only after an operator has verified and
activated the exact source, Worker version and image digest. A normal image
entrypoint runs `remote_worker.py --once`: claim at most one request, finish it,
then exit. An empty queue therefore leaves no continuously running VM. Duplicate
ticks share the running process; at most one normal start is accepted per UTC
minute. Failures add bounded backoff. A lost observation is recorded as unknown,
not a clean exit.

The durable queue's existing lease decides the fate of an interrupted job. It
never retries the billed author request. A failed/expired job still requires a
new owner request. The bounded wrapper terminates a cycle after 20 minutes plus
30 seconds of drain and cleans its own process group. SIGTERM asks the worker to
finish its current claim and stop taking new work.

The existing 90-second heartbeat remains the only website availability signal.
Neither `container.start()`, a running VM, nor an operator preflight writes one.
A missed minute or slow cold start can temporarily make the UI unavailable;
measure real heartbeat gaps before cutover instead of extending this threshold
to hide an unavailable worker. Cron configuration can take time to propagate.

Every awaited container call is bounded; `monitor()` and storage calls are not.
Inside the object `inspect`, `setInactivityTimeout` and `destroy` get 20 seconds
and `exec` 60. An unanswered call fails that one operation and is logged as
`teacher_cloud_platform_timeout` with the call's name. Its answer is dropped, but
the call itself cannot be withdrawn: after an unanswered `destroy` this instance
of the object starts no check container until that destroy settles, and sends no
second one; a rebuilt object does not remember it. A check that starts late is
stopped. A run is watched before its keep-alive is confirmed. If the keep-alive
of the tick that started the run goes unanswered, that tick is recorded as a
failed cycle, the run is still observed to its end, a clean exit clears the
failure, and a failed exit is counted once with its pause running from the
failure. A later busy tick whose keep-alive goes unanswered fails without
changing state. After a rebuild a run is watched again only once it could be
inspected; while inspect stays unanswered its end is recorded as unknown. The
re-arm after a rebuild is a single attempt, logged as
`teacher_cloud_rearm_unconfirmed` when it is not confirmed.

Status is read-only and is not queued. With deactivate it answers from stored
state when a running container cannot be inspected: `running` true with
`observedImage` null. The apply phases of the release guard read that as a
mismatch; `--observe` does not print `observedImage`.

Outside the object the Worker stops waiting after 45 seconds on a cron tick
(`teacher_cloud_cycle_timeout`), 30 on status, 330 on preflight and 90 on the
other operator routes, which then answer 504 `CLOUD_OPERATION_TIMEOUT`. A 504
means no answer in time, not that the operation was dropped: it may still be
carried out. A refusal stays 503 `CLOUD_OPERATION_FAILED`.

These limits exist because on 2026-11-25 the object ran no cycle and answered
neither status nor deactivate for 5 h 36 min, most likely because of one
unanswered container call. The 20-second figure is a judgment, not a
measurement of the platform.

## Operator boundary

The public Worker exposes no lesson, artifact, shell or arbitrary command API.
Only the fixed `/operator/*` routes in `operator-contract.json` exist. They
require a random 32-byte hex Bearer secret and refuse browser Origin requests.
No secret, model response or raw exception is returned. No public caller can
choose another Durable Object name or container command.

Preflight starts the exact image with an inert entrypoint and executes only the
fixed Python `--check-only` command. It checks the exit code, bounded JSON flags,
and observed image digest, then stops that preflight container. It cannot claim,
heartbeat, upload or call the model. A PASS expires after 15 minutes. Activation
requires that same source/image/Worker version; a changed version cannot inherit
an older activation. Deactivation stops future cycles and lets existing work
drain.

Runtime secrets are `TEACHER_GENERATION_SERVICE_KEY`, `QWEN_API_KEY`,
`QWEN_BASE_URL`, `QWEN_MODEL`, and `TEACHER_CLOUD_OPERATOR_KEY`. Supply them through
Cloudflare secrets, never build arguments, image layers, logs or committed files.
Three more names are optional and reach the worker only when set:
`TEACHER_AUTHOR_PROVIDER` (the author switch), `GEMINI_API_KEY` and `GEMINI_MODEL`.
The release tool's runtime-secrets file still accepts only the five names above
(`tools/release/teacher-cloudflare-release.py`, `RUNTIME_SECRET_KEYS`); switching the
author in production needs that list extended on the controller branch first.
The existing renderer subprocess environment remains filtered. The image contains
the exact skill archives and fonts, not machine-specific home directories.

Use only `tools/release/release.sh` with `RELEASE_TARGET=teacher-cloudflare` for
image push, preflight deployment and activation. Its separate ledger never
substitutes a Wix deployment record. Stop the Mac consumer only after cloud
preflight succeeds, the queue is empty and the approved cutover is ready. Observe
several real cloud heartbeats while the local LaunchAgent is stopped. Confirm an
owner-created request and private PDF/DOCX before claiming full cloud end-to-end
success; offline fixtures do not establish a live provider call.

## Tests and image qualification

`npm ci --ignore-scripts`, `npm run check`, and `npm test` check the supervisor,
token boundary, proof matching, duplicate delivery, backoff and drain behavior.
`npm run build` is Wrangler's dry-run; a Dockerfile-based image requires Docker
even for that command. It does not substitute the Linux image qualification.

The `Teacher generation cloud qualification` GitHub workflow builds the pinned
Linux image, runs the worker tests and the three reviewed fixtures with network
disabled, exercises the existing Chromium fallback, and preserves the PDFs,
DOCX files and gate reports for visual inspection. A separate OCI image artifact
has a one-day retention and its exact source label and digests. The release
guard verifies that artifact and its successful CI run before uploading it to
Cloudflare's managed registry. CI has no deployment or provider credentials.

## Billing and limitations

Cloudflare Containers requires Workers Paid: $5/month plus usage. RAM and disk
are charged while a container runs, including model/network waits. One-minute
short cycles reduce idle cost but are not a hard spending cap. As an example,
150 ten-minute jobs and 3–5-second idle starts in a 30-day month give roughly
$8.79–$10.57 for the base and compute, before other services; a ten-second idle
start changes that example to about $15.01. Measure the deployed image's whole
lifetime and check the account's included usage before treating any example as
a forecast. The model and Supabase retain their separate billing.

The `durable_object` scheduling policy is currently beta. This policy has no
platform `max_instances` field: the fixed-name code and absence of arbitrary
routing enforce the singleton in this application. It also does not make the
Linux UID a security boundary. Only reviewed code and closed numeric model data
are executed; there is no uploaded code/markup or general command interface.

Official references, checked 2026-11-14:

- [Cron containers](https://developers.cloudflare.com/containers/examples/cron/)
- [Container lifecycle API](https://developers.cloudflare.com/containers/api/durable-object-container/)
- [Scheduling policies](https://developers.cloudflare.com/containers/configuration/scheduling-policy/)
- [Pricing](https://developers.cloudflare.com/containers/platform/pricing/)
