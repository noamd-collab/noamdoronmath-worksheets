-- Accept bounded dot-separated canonical IDs from measured worksheet exports.
-- Source IDs and all row data remain unchanged. Do not edit historic migration.
-- One atomic constraint replacement; no RLS, grants, indexes or other checks change.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
alter table public.noam_worksheet_edition_hints
  drop constraint noam_worksheet_edition_hints_canonical_item_id_check,
  add constraint noam_worksheet_edition_hints_canonical_item_id_check
  check (
    char_length(canonical_item_id) between 1 and 128
    and canonical_item_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]*([.][A-Za-z0-9][A-Za-z0-9_-]*)*$'
  );
commit;
