# Free HTTP worker pilot — preparation only

This package wraps the existing, reviewed worker without changing its model,
worksheet, ownership, lease, artifact or database contracts. The current Mac
worker remains the active worker until an explicitly reviewed cutover. Nothing
in this directory creates a hosting account, adds a payment method, deploys a
service, activates job processing or uses the owner's final generation trial.

Only the new generator is owner-only. The regular teacher tools remain available
to every authenticated Google teacher; this server is not an authentication path
for those tools. Its shared key is held by the website server, never the browser.

## HTTP contract

Bind `0.0.0.0` at `PORT` (default `10000`, decimal integer `1..65535`). Server
startup permits a disabled, secretless first deployment so `/healthz` works before
keys are installed; every authenticated endpoint refuses an empty key.
`WORKER_WAKE_SECRET`, when present or when activating, must be exactly 64
lowercase hex characters. There is no default key.
`TEACHER_FREE_WORKER_ENABLED=true` is the only activation
value; absent, differently cased, or other values remain disabled. Activation
does not start a worker; it merely permits a later authenticated wake.

| Endpoint | Request | Result and side effects |
| --- | --- | --- |
| `GET /healthz` | Public, no payload | `200 {"ok":true}`; HTTP liveness only. No preflight, database, heartbeat, model or claim. |
| `POST /preflight` | `Authorization: Bearer <key>`, empty body | `202 {"ok":false,"state":"checking"}` starts one fixed `remote_worker.py --check-only` child. Polling returns `200 ready` or `503 failed`, with the same `ok/state` shape. Results are cached for at most 60 seconds; polling during a worker returns `503 busy` rather than starting an overlapping child. |
| `POST /wake` | Same authentication, empty body | `202 {"ok":true,"state":"starting"}` or `running` extends the admission window to 60 seconds from this request. `503 disabled/draining/unavailable` refuses admission. This is never an online proof. |

Both POST endpoints accept no lesson, user, command, path or configuration input.
Requests with an Origin, a body, transfer encoding, duplicate authorization or
duplicate content length are rejected. There is no CORS support. Unknown paths,
query strings and other methods do not trigger work. Responses are small,
non-sensitive and `no-store`. Request/header/body/env values are never logged.
The server limits concurrent HTTP connections to eight and times out stalled
reads after five seconds.

The website must continue using the existing database heartbeat to determine
worker availability. A wake acknowledgement, HTTP health response or successful
preflight must not be substituted for that heartbeat. The preflight verifies
the worker's explicit `claimVerified=false`, `providerCalled=false` and
`heartbeatWritten=false` proof; it advertises no readiness itself.

During cutover, both runtimes use the existing heartbeat row `primary`. The old
Mac worker must be drained and stopped before activation, with the queue checked
again immediately before the cloud worker starts. An old, still-fresh heartbeat
is not proof that the cloud worker works: either wait for its 90-second expiry
or require a heartbeat timestamp strictly after the verified cloud activation
and wake. A successful empty claim may establish that proof without creating a
job or calling the model. Never consume the owner's reserved trial to test
hosting availability. The guarded operator flow owns this provenance check.

## Lifecycle and limits

One supervisor runs fixed `remote_worker.py --once --work-dir /work/jobs` children
serially, with a five-second pause between cycles. It starts only after an
authenticated wake and admits no further cycle after the 60-second window.
Another authenticated wake extends that window. A job already claimed may drain
beyond the idle window. Failed process/transport cycles close the window, so the
adapter does not create an automatic failure retry loop. Existing worker logic
also never retries a failed model job; a new owner request is required.

Each child has at most 745 seconds of normal runtime, then up to 30 seconds to
drain and five seconds to reap its process group: 780 seconds total (13 minutes).
Together with the admission window this stays within 14 minutes from the last
authenticated request. Native render stages retain their unchanged 240-second
limits. Preflight is independently bounded to 110 seconds plus one second of
termination and five seconds of reaping. On SIGTERM/SIGINT, admission closes,
only the worker parent initially receives TERM (so its renderer can drain), and
remaining descendants are killed after the drain deadline. Lost or expired jobs
retain the existing database handling; no lease reset, quota refund or retry is
invented by this server.

These bounds conservatively precede Render Free's documented 15-minute idle
spin-down, but do not guarantee protection against a provider restart or forced
termination. Render documents approximately a minute to wake, ephemeral local
files, a 750-hour monthly allowance, and possible service suspension. It advises
against using Free for production applications. This remains a bounded private
pilot. With no payment method, exceeding bandwidth suspends Free services rather
than adding bandwidth charges; verify account/payment/plan state separately
before any deployment. Never add a paid plan or payment method implicitly.

Official references, checked 2026-11-14:
[Free limits](https://render.com/docs/free),
[HTTP binding](https://render.com/docs/web-services),
[health checks](https://render.com/docs/health-checks).

## Image and secrets

Build `tools/teacher-generation/cloud/render/Dockerfile` from the repository root.
It is self-contained: the native build prefix is byte-identical to the existing
locked `cloud/container/Dockerfile`, verified by a packaging test. It changes
only the HTTP entrypoint and adds disabled-by-default HTTP metadata. Its Docker
ignore extends the existing explicit source allowlist by exactly three Render
files. No build secret, private base image, registry connection, native package,
dependency, font or installed skill is added or changed. Record the final
immutable image digest during qualification and verify the exact reviewed
source during the guarded provider build. The existing Cloudflare Dockerfile
and its build context are not modified.

The existing four runtime values (`QWEN_API_KEY`, `QWEN_BASE_URL`, `QWEN_MODEL`,
`TEACHER_GENERATION_SERVICE_KEY`) and the new `WORKER_WAKE_SECRET` belong only in
private server environment configuration. No real values belong in a Docker
layer, source checkout, workflow artifact, response or PR. The child environment
forwards only the existing fixed runtime allowlist; it strips the wake key,
activation setting, Python injection variables and unrelated platform secrets.

A future service must be explicitly verified as `free`, no payment method,
one instance, `/healthz` health check, and automatic deployment disabled. A
successful offline build is not approval to create or deploy it. All publishing
still goes through `tools/release/release.sh` and its reviewed release guard.

## Qualification

`python3 -B tools/teacher-generation/cloud/render/test_http_supervisor.py -v`
checks local HTTP behavior, concurrency, admission expiry, preflight isolation,
shutdown and subprocess bounds with fake children only.

The prior fixed-runtime resource probe (PR464, source `80a11774`) passed all
three reviewed worksheets plus Chromium fallback under 512 MiB RAM, no swap and
0.1 CPU, with a maximum peak of 349.32 MiB and maximum case duration of 154.29
seconds. It did not include this HTTP process, real provider/TLS overhead or
Render cold start. The combined supervisor must pass a second, separate offline
qualification under the same limits before any deployment plan is approved.
That test must preserve all input fixture hashes and exercise the actual HTTP
process with only explicitly mounted CI fakes for transport and authoring,
network disabled and zero paid calls. It is still not a live platform test.
