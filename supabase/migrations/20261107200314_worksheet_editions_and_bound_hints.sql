-- Prepared locally from observed-schema.json. No seed or learner-data changes.
-- Keep all historic worksheet IDs, including IDs absent from today's catalog.
begin;

alter table public.noam_learning_worksheets
  drop constraint noam_learning_worksheets_worksheet_id_check;
alter table public.noam_learning_worksheets
  add constraint noam_learning_worksheets_worksheet_id_check
  check (worksheet_id ~ '^g[1-9]-t[0-9]+-(a|b|c|c2|one)(-e-[a-z0-9][a-z0-9-]{0,63})?$'
    and worksheet_id !~ '-e-legacy$');

-- One immutable edition has one binding for each public exercise identity.
-- Review references are private provenance, not a declaration that SQL has
-- authenticated a reviewer or checked the review's mathematical conclusions.
create table public.noam_worksheet_edition_hints (
  edition_id text not null check (edition_id ~ '^[a-z0-9][a-z0-9-]{0,63}$' and edition_id <> 'legacy'),
  exercise_id text not null check (exercise_id ~ '^G[1-9]-T[0-9]{2}-([ABE]|E2)-Q[0-9]{2}[א-ת]?$'),
  source_pdf_hash text not null check (source_pdf_hash ~ '^[a-f0-9]{32}$'),
  source_pdf_sha256 text not null check (source_pdf_sha256 ~ '^[a-f0-9]{64}$'),
  canonical_source_sha256 text not null check (canonical_source_sha256 ~ '^[a-f0-9]{64}$'),
  canonical_question_sha256 text not null check (canonical_question_sha256 ~ '^[a-f0-9]{64}$'),
  canonical_item_id text not null check (canonical_item_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$'),
  source_exercise_sha256 text not null check (source_exercise_sha256 ~ '^[a-f0-9]{64}$'),
  hint_1 text not null check (char_length(btrim(hint_1)) between 1 and 600),
  hint_2 text not null check (char_length(btrim(hint_2)) between 1 and 600),
  hint_3 text not null check (char_length(btrim(hint_3)) between 1 and 600),
  status text not null default 'review' check (status in ('review','verified')),
  review_reference jsonb,
  updated_at timestamptz not null default now(),
  primary key (edition_id, exercise_id),
  unique (edition_id, canonical_item_id),
  unique (source_pdf_hash, exercise_id),
  constraint edition_hints_verified_review_reference check (
    status <> 'verified' or coalesce(
      jsonb_typeof(review_reference) = 'object'
      and review_reference->>'sha256' ~ '^[a-f0-9]{64}$'
      and char_length(btrim(review_reference->>'path')) between 1 and 2000
      and char_length(btrim(review_reference->>'reviewerId')) between 1 and 128
      and char_length(btrim(review_reference->>'authorId')) between 1 and 128
      and lower(btrim(review_reference->>'reviewerId')) <> lower(btrim(review_reference->>'authorId')),
      false)
  )
);

alter table public.noam_worksheet_edition_hints enable row level security;
revoke all on public.noam_worksheet_edition_hints from public, anon, authenticated;
grant select (
  edition_id, exercise_id, source_pdf_hash, source_pdf_sha256,
  canonical_source_sha256, canonical_question_sha256, canonical_item_id,
  source_exercise_sha256, hint_1, hint_2, hint_3, status
) on public.noam_worksheet_edition_hints to anon, authenticated;
create policy edition_hints_verified_read
  on public.noam_worksheet_edition_hints for select to anon, authenticated
  using (status = 'verified');
grant select, insert, update, delete on public.noam_worksheet_edition_hints to service_role;

comment on table public.noam_worksheet_edition_hints is
  'Reviewed worksheet-edition hints. Public columns only; verified rows only. Import requires separate hash-bound source/hint review.';

commit;
