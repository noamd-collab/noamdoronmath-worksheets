-- M1 (V5-DESIGN §15). A worksheet-wire/5 draft is PDF-only. The one readiness rule
-- (noam_teacher_generation_draft_downloadable) learns that contract, and the trial
-- credit is kept for a complete draft instead of a PDF+Word pair. Owner identity,
-- Google requirements, quota, upload rights, every Storage policy and every result
-- without authorContract=worksheet-wire/5 are unchanged.
begin;
-- Writers wait until commit, so no trigger call in flight meets the dropped complete_pair.
-- Fail fast rather than queue behind a long transaction.
set local lock_timeout = '5s';
lock table public.noam_teacher_generation_jobs in share row exclusive mode;

create or replace function public.noam_teacher_generation_draft_downloadable(document jsonb)
returns boolean
language sql immutable security invoker set search_path='' as $$
  select coalesce(case
    when document is null or pg_catalog.jsonb_typeof(document) is distinct from 'object' then false
    -- worksheet-wire/5: exactly one PDF, every executed step PASS. A SKIP counts only on the
    -- middle path, only for a step Noam approved in D22 (2026-11-25, runner.V5_NOT_RUN_ALLOWED),
    -- and only when the draft also reports it in notRun. REVIEW and FAIL always deny.
    when document->>'authorContract'='worksheet-wire/5' then
      case when pg_catalog.jsonb_typeof(document->'artifacts')='array'
            and pg_catalog.jsonb_typeof(document->'notRun')='array'
            and pg_catalog.jsonb_typeof(document->'checks')='array' then
        coalesce(
          document->>'authoringProfile'='general-skill-source/v1'
          and document->'humanReviewRequired'='true'::jsonb
          and pg_catalog.jsonb_typeof(document->'automatedChecksPassed')='boolean'
          and pg_catalog.jsonb_typeof(document->'renderingChecksPassed')='boolean'
          and document->'skill'->>'name' in ('elementary','middle')
          and pg_catalog.jsonb_array_length(document->'artifacts')=1
          and document->'artifacts'->0->>'kind'='pdf'
          and not exists(select 1 from pg_catalog.jsonb_array_elements(document->'notRun') n
                         where pg_catalog.jsonb_typeof(n) is distinct from 'string')
          and pg_catalog.jsonb_array_length(document->'checks')>0
          -- SKIPs alone prove nothing: at least one step must have run and passed.
          and exists(select 1 from pg_catalog.jsonb_array_elements(document->'checks') c where c->>'status'='PASS')
          and not exists(select 1 from pg_catalog.jsonb_array_elements(document->'checks') c
                         where not coalesce(
                           pg_catalog.jsonb_typeof(c->'name')='string' and (
                             c->>'status'='PASS'
                             or (c->>'status'='SKIP' and document->'skill'->>'name'='middle'
                                 and c->>'name' in (
                                   'pinned:emit_docx','pinned:catalog/landing',
                                   'pinned:gate_sections G85–G92',
                                   'pinned-gate:G85-section-volume:sheet','pinned-gate:G86-terms:sheet',
                                   'pinned-gate:G87-subtopic-chronology:sheet',
                                   'pinned-gate:G88-level-parity:sheet','pinned-gate:G89-catalog:sheet',
                                   'pinned-gate:G92-section-structure:sheet')
                                 and document->'notRun' ? (c->>'name'))),
                           false))
          -- Nothing may be reported as fully checked while anything did not run.
          and (document->'automatedChecksPassed'='false'::jsonb and document->'renderingChecksPassed'='false'::jsonb
               or (pg_catalog.jsonb_array_length(document->'notRun')=0
                   and not exists(select 1 from pg_catalog.jsonb_array_elements(document->'checks') c
                                  where c->>'status' is distinct from 'PASS'))),
          false)
      else false end
    when document->'automatedChecksPassed'='true'::jsonb then
      case
        -- Retain historical PASS records that predate explicit check arrays.
        when not (document ? 'checks') then true
        when pg_catalog.jsonb_typeof(document->'checks')='array' then
          not exists(select 1 from pg_catalog.jsonb_array_elements(document->'checks') c
                     where c->>'status' is distinct from 'PASS')
        else false
      end
    when document->'automatedChecksPassed'='false'::jsonb
      and document->>'authoringProfile'='general-skill-source/v1'
      and document->'renderingChecksPassed'='true'::jsonb
      and document->'humanReviewRequired'='true'::jsonb then
      case when pg_catalog.jsonb_typeof(document->'checks')='array' then
        pg_catalog.jsonb_array_length(document->'checks')>0
        and not exists(select 1 from pg_catalog.jsonb_array_elements(document->'checks') c
                       where coalesce(c->>'status','') not in ('PASS','REVIEW'))
      else false end
    else false
  end, false);
$$;
comment on function public.noam_teacher_generation_draft_downloadable(jsonb) is
  'The one JSON readiness rule for private drafts: PASS, a documented REVIEW draft, or a PDF-only worksheet-wire/5 draft whose only SKIPs are the D22-approved steps. No data access or elevated privileges.';

-- The files a complete draft must have: a worksheet-wire/5 draft is its PDF; every other
-- draft is still the exact PDF+Word pair. Checked in the transaction that keeps the credit.
create function noam_teacher_trial.complete_draft(actor uuid, job uuid, document jsonb) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(public.noam_teacher_generation_draft_downloadable(document), false)
    and exists(select 1 from storage.objects where bucket_id='teacher-generation-private'
                 and name=actor::text||'/'||job::text||'/sheet.pdf')
    and (coalesce(document->>'authorContract'='worksheet-wire/5', false)
         or exists(select 1 from storage.objects where bucket_id='teacher-generation-private'
                     and name=actor::text||'/'||job::text||'/sheet.docx'))
$$;
revoke all on function noam_teacher_trial.complete_draft(uuid,uuid,jsonb) from public, anon, authenticated, service_role;
grant execute on function noam_teacher_trial.complete_draft(uuid,uuid,jsonb) to service_role;

-- Same bodies as 20261122151819; only complete_pair became complete_draft.
create or replace function public.noam_teacher_generation_quota() returns trigger
language plpgsql security invoker set search_path='' as $$
declare subject bytea; until_at timestamptz;
begin
  perform pg_advisory_xact_lock(1171212,hashtext(new.owner_id::text));
  if exists(select 1 from public.noam_teacher_generation_jobs where owner_id=new.owner_id and request_key=new.request_key) then
    raise exception using errcode='23505',message='REQUEST_CONFLICT';
  end if;
  if exists(select 1 from public.noam_teacher_generation_jobs where owner_id=new.owner_id and status in ('queued','running')) then
    raise exception using errcode='PT423',message='GENERATION_ACTIVE';
  end if;
  if new.owner_id='80da2957-9492-4a9d-babb-28ba70dedd12'::uuid then return new; end if;
  subject := noam_teacher_trial.google_subject(new.owner_id);
  if subject is null then raise exception using errcode='42501',message='GENERATION_ACCESS_DENIED'; end if;
  -- Re-linking an authenticated account to the same Google subject must share
  -- both its five slots and the lock used to reserve them.
  perform pg_advisory_xact_lock(1171213,hashtext(encode(subject,'hex')));
  until_at := noam_teacher_trial.lock_active_window();
  if until_at is null or clock_timestamp()>=until_at then
    raise exception using errcode='PT403',message='TRIAL_CLOSED';
  end if;
  if not noam_teacher_trial.worker_ready() then
    raise exception using errcode='PT503',message='TRIAL_WORKER_UNAVAILABLE';
  end if;
  if new.status='needs_review' and not noam_teacher_trial.complete_draft(new.owner_id,new.id,new.result) then
    raise exception using errcode='23514',message='GENERATION_INCOMPLETE_DRAFT';
  end if;
  if new.status<>'failed' then
    if noam_teacher_trial.remaining(subject)=0 then
      raise exception using errcode='PT429',message='GENERATION_LIMIT';
    end if;
    insert into noam_teacher_trial.reservations(job_id,subject_hash) values(new.id,subject);
  end if;
  return new;
end $$;
create or replace function noam_teacher_trial.release_failure() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if old.status='failed' then
    raise exception using errcode='23514',message='GENERATION_FAILED_TERMINAL';
  end if;
  if new.status='needs_review' and not noam_teacher_trial.complete_draft(new.owner_id,new.id,new.result) then
    new.status := 'failed'; new.phase := 'failed'; new.error_code := 'DRAFT_NOT_AVAILABLE';
    new.result := null; new.lease_token := null; new.lease_until := null;
  end if;
  if new.status='failed' then delete from noam_teacher_trial.reservations where job_id=new.id; end if;
  return new;
end $$;
drop function noam_teacher_trial.complete_pair(uuid,uuid,jsonb);
commit;
