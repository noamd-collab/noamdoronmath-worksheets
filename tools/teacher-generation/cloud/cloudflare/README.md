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
