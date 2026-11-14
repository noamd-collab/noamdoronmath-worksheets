# Free Render pilot release

This is an optional private pilot for the owner-only worksheet generator. The
ordinary teacher area remains available to every verified Google account. Nothing
in this path purchases Cloudflare, enables paid Render compute, resets quota, or
uses a generation trial. Hosting is not active merely because this code passes CI.

## Provider constraints and verified scope

[Render Free](https://render.com/docs/free) is a web service with 512 MiB memory,
0.1 CPU, ephemeral disk, 750 workspace instance-hours per month, and suspension
after 15 minutes without inbound traffic. Waking can take about a minute. This is
a limited pilot, not an availability promise. The original 4 offline fixtures
passed under those CPU/memory limits; the HTTP qualification must separately pass
at the final reviewed commit. Neither result proves live cold-start time, model
latency, outbound-network performance, or the owner's final worksheet quality.

No card/payment method is permitted for this pilot. Render documents suspension
or stopped builds on free allowances without a payment method; an attached card
changes that financial behavior. The public API does not expose card state, so a
recent dashboard observation is required in the operator context. This guard
cannot prevent a human from later adding a card or changing the service outside
the guard. Recheck the dashboard before each deployment. Never add a card to
resolve quota, verification, build, or registration restrictions.

## Only deployment entry point

Use `RELEASE_TARGET=teacher-render-free tools/release/release.sh`. Do not run a
dashboard deploy or an independent provider mutation. Without `--apply`, all
phases produce a local plan and make no network request. The guard uses the fixed
Render API origin, TLS verification, no redirects, a single fixed service,
explicit `plan: free`, one instance, disabled previews and automatic deployment,
and no disk or autoscaling. The Dockerfile builds directly from the repository.

The plan is exact JSON with these fields:

```json
{
  "target": "teacher-render-free",
  "sourceSha": "<40-character reviewed source SHA>",
  "ownerId": "<actual Render workspace ID>",
  "serviceName": "noam-teacher-generation",
  "branch": "codex/teacher-generation-free-render-20261114",
  "plan": "free",
  "region": "frankfurt",
  "autoDeployTrigger": "off"
}
```

The reviewed source must be clean, the branch must still point to that source,
and it must already be an ancestor of canonical. The plan digest binds the
approval, qualification evidence and operator ledger. The approval context must
record the actual human approval reference, approved plan digest, exact passed
qualification source, actual workspace identity, Hobby plan, absence of payment
method, and billing observation timestamp within one hour. Do not invent these
observations or convert another agent's message into human approval.

Context, runtime-secret JSON, and the state directory stay outside all checkouts;
files must be owned by the operator and mode 0600, the directory mode 0700. Do not
put tokens on command lines or in the plan. `RENDER_API_KEY` is consumed only by
the operator process and never copied to the runtime. Standard Python HTTPS trust
must work; repair/use a valid trust store if necessary, never disable verification.

## Ordered phases

1. **Create:** After account access, no-card evidence, final CI, exact PR/plan
   approval, create a secretless, disabled service. Record its service/deployment
   identities durably. Health may return 200; no worker starts.
2. **Configure:** Verify the initial deployment is live at the exact source.
   With the authorized runtime destination, install exactly five keys and keep
   `TEACHER_FREE_WORKER_ENABLED=false`: `WORKER_WAKE_SECRET` (64 lowercase hex),
   `TEACHER_GENERATION_SERVICE_KEY`, `QWEN_API_KEY`, `QWEN_BASE_URL`, `QWEN_MODEL`.
   This deploys the same commit with worker claims still disabled.
3. **Inspect:** Require the requested disabled deployment ID, not merely an older
   deployment of the same source. Only a live exact source advances the ledger.
4. **Preflight:** Authenticated empty POST `/preflight` runs only the worker's
   `--check-only` path. Repeat the explicit check while `checking` until `ready`.
   It does not claim work, call the model, write a heartbeat, or consume quota.
   The result is bound to the deployed source, deployment ID and runtime values.
5. **Activate:** Fresh preflight within 90 seconds, zero queued/running jobs and
   the old Mac worker stopped (both observations within 90 seconds) are required.
   `macWorkerCheckedAt` records a fresh verification that it is still stopped,
   not the earlier time the stop command was issued.
   Enable the same runtime values, deploy the exact source, inspect the requested
   deployment ID, then configure the owner-only site wake URL/secret through the
   site's guarded publication path. Do not have two active claimants during the
   cutover. Do not stop the Mac before the disabled cloud preflight succeeds.

`activeJobs` is the count of both `queued` and `running` rows for the owner,
without any lease-time filter. A read-only request selecting IDs with
`status=in.(queued,running)` must return an empty array after drain and again
immediately before activation. An empty queued subset is insufficient.
`macWorkerStopped` requires more than a successful stop command: back up the
LaunchAgent plist, boot out and disable `il.co.noamdoronmath.teacher-generation`,
verify the service is absent, and verify the recorded worker PID and its
descendants have exited. Do not kill unrelated processes or merely stop a
process that launchd can restart. Record these real observations, not assumed
values, with the fresh timestamps required by the guard.

`GET /healthz` reports only the HTTP listener. It never advertises DB readiness.
The release guard has no `/wake` operation. Runtime readiness requires the site's
authorized owner wake and a genuine fresh worker DB heartbeat. The current DB
health row is shared by Mac and cloud; wait for the old heartbeat to expire
(over 90 seconds), then require a new `updated_at` after cloud activation before
calling the cloud ready. A healthy listener
or a 202 wake response alone is not proof of generation readiness. Verify an
empty-queue heartbeat only when the owner is not concurrently creating a job;
leave the reserved final generation trial to Noam.

The request budget is bounded: one serial worker, a 60-second admission window,
and a maximum child cycle including drain of 13 minutes. The guard and worker
never retry a failed model job automatically. Provider termination can still
interrupt a job; the existing lease and failure semantics apply.
The site sends one additional wake after the durable enqueue. If dispatch is
not acknowledged, it retains that same job/key and displays that work is still
waiting; it never reserves another quota slot or automatically posts a new job.
An old child cannot erase a newer, still-valid wake, including near the end of
the window. If that child remains blocked beyond the full 60-second admission
window, a later owner refresh is required; the server does not extend the
14-minute budget. An accepted wake therefore is not a guarantee that closing
the browser will allow every transport-failure case to complete unattended.

A hard kill can leave a job `running` until its last renewed 20-minute lease
expires. Expiry alone does not update the row: the next worker claim marks it
`failed` with `WORKER_INTERRUPTED`; it never returns that job to `queued` or
repeats its model call. If the host remains asleep, recovery waits for a later
owner wake/refresh. During this interval the UI can show the existing active-job
or quota-limit message. This is a known Free-pilot recovery limitation. Do not
shorten a lease blindly, clear ownership while a child may still run, refund
quota, or create another job as an automatic recovery action.

## Uncertainty and receipts

Every mutation first writes an `uncertain` ledger state. A lost response, failed
identity check, failed deployment or later drift does not trigger automatic
retry, rollback, service recreation, paid upgrade, quota reset or Mac restart.
Keep the receipt and stop the transition. Reconcile read-only against the exact
workspace/service/deploy IDs and get the required concrete recovery approval
before repairing the ledger. Do not delete the ledger to bypass this stop.

Receipts contain only IDs, state, timestamps and digests. Never paste provider
bodies, environment listings, account tokens, or runtime secrets into a PR, chat,
log or screenshot. A running cloud host is only reported after exact live
deployment and real heartbeat evidence; publication, cutover, owner trial, and
external Manus review are distinct outcomes.

Official API references: [create service](https://api-docs.render.com/reference/create-service),
[replace environment](https://api-docs.render.com/reference/update-env-vars-for-service),
[create exact-commit deploy](https://api-docs.render.com/reference/create-deploy).
