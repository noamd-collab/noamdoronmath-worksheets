-- Owner-authorized rebinding, 2026-11-02 (Noam). No hint text changes; no model calls.
-- Second step, after ramzi-hints-rebind-final-answers-20261102.sql: the three G8-T65 PDFs
-- were republished on Wix with newly written final-answers pages. Their question pages are
-- unchanged (pixel-identical above the page-count footer), so their hints follow them.
-- Only source_pdf_hash changes; hints, native bindings, status, source and source_id stay.
-- Idempotent: a no-op when the final bank is already present.
begin;
lock table public.noam_ramzi_hints in share row exclusive mode;
do $rebind$
declare bank_count bigint; core_sha text; affected bigint;
begin
  select count(*),encode(sha256(convert_to(string_agg(concat_ws(chr(31),exercise_id,hint_1,hint_2,hint_3,source_pdf_hash,coalesce(source_native_sha256,''),status,source,source_id),chr(30)order by exercise_id collate "C"),'UTF8')),'hex') into bank_count,core_sha from public.noam_ramzi_hints;
  if bank_count=31670 and core_sha='507bd0811fb28e859ea612a27e603f7e80aa33a37952c24e0959e14f0d2c4ca5' then return; end if;
  if bank_count<>31670 or core_sha is distinct from 'a14e5ecc87fec7af296135dfe55d1298e9d987b50b7dac0d88dc14a2fd042033' then raise exception 'Prepared hint bank is not at the state after the first rebinding; refusing'; end if;
  create temporary table rebind_map(old_pdf text primary key,new_pdf text not null,expected bigint not null) on commit drop;
  insert into rebind_map(old_pdf,new_pdf,expected) values
    ('1626318ee2c94f6a9b53ffcaf289ec83','1ccae5fe64b54f459395ee3c454f30bb',44),
    ('993467c2757a4950abd2a0237f18a48c','03715f890d4c4ff096384c2f00ccccf0',38),
    ('fc62c3516b5c4f4c8e3f433792c84c40','6d6a93579d99417fb11f1763de507490',41);
  update public.noam_ramzi_hints h set source_pdf_hash=m.new_pdf from rebind_map m where h.source_pdf_hash=m.old_pdf;
  get diagnostics affected=row_count;
  if affected<>123 then raise exception 'Expected 123 rebound rows, got %',affected; end if;
  select count(*),encode(sha256(convert_to(string_agg(concat_ws(chr(31),exercise_id,hint_1,hint_2,hint_3,source_pdf_hash,coalesce(source_native_sha256,''),status,source,source_id),chr(30)order by exercise_id collate "C"),'UTF8')),'hex') into bank_count,core_sha from public.noam_ramzi_hints;
  if bank_count<>31670 or core_sha is distinct from '507bd0811fb28e859ea612a27e603f7e80aa33a37952c24e0959e14f0d2c4ca5' then raise exception 'Rebinding verification failed'; end if;
end;
$rebind$;
commit;
