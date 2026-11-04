-- Owner-authorized editorial corrections, 2026-11-01. No new model calls or reviews.
-- Update one hint in each target row; source bindings, other hints, RLS and grants are preserved.
begin;
lock table public.noam_ramzi_hints in share row exclusive mode;
do $editorial$
declare bank_count bigint; core_sha text; affected bigint;
begin
  select count(*),encode(sha256(convert_to(string_agg(concat_ws(chr(31),exercise_id,hint_1,hint_2,hint_3,source_pdf_hash,coalesce(source_native_sha256,''),status,source,source_id),chr(30)order by exercise_id collate "C"),'UTF8')),'hex') into bank_count,core_sha from public.noam_ramzi_hints;
  if bank_count=31670 and core_sha='608051e56ac7fe7cf286651ff1c63a55b9c736ba4f92ec56e8a5685eec6f484e' then return; end if;
  if bank_count<>31670 or core_sha is distinct from 'f6cef1eec910a32c0575a6148f6c83a1d16500f05ad23f066d0af3f3cb3e6242' then raise exception 'Prepared hint bank changed; refusing editorial update'; end if;
  update public.noam_ramzi_hints set hint_1='כיצד תתאימו בין הצלעות לפי סדר אורכיהן, כאשר ידוע שהצלע החסרה מתאימה לצלע הארוכה במשולש האחר?'
  where row(exercise_id,hint_1,hint_2,hint_3,source_pdf_hash,source_native_sha256,status,source,source_id) is not distinct from row('G8-T45-E2-Q02א','מהי הצורה הגיאומטרית של המשולשים הנתונים בשאלה?','השוו בין אורכי הצלעות המתאימות במשולשים כדי לקבוע אם הם פרופורציונליים.','בדקו האם היחס בין כל זוג צלעות מתאימות הוא זהה, ובכך תוכלו לקבוע אם המשולשים דומים לפי משפט דמיון רלוונטי.','e4da722565a942e482c9e4dbf6ee41b5',null,'verified','ramzi-flash-authored-20261031','G8-T45-E2-Q02א');
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Expected one guarded target row'; end if;
  update public.noam_ramzi_hints set hint_2='פרקו את המכנה \(x^2 - 49\) כהפרש ריבועים, ואת המונה \(x^2 - 5x - 14\) כטרינום רגיל.'
  where row(exercise_id,hint_1,hint_2,hint_3,source_pdf_hash,source_native_sha256,status,source,source_id) is not distinct from row('G9-T04-A-Q02א','האם ניתן לפרק את המונה ואת המכנה לגורמים לפני הצמצום?','פרקו את המכנה x^2 - 49 כהפרש ריבועים, ואת המונה x^2 - 5x - 14 כטרינום רגיל.','בטלו את הגורם המשותף שמתקבל, ורשמו את הערכים האסורים לפי המכנה המקורי.','3422bed5e0164d6688e894e0382a8d06','a7564b9dd2ca6da9eabb972fde86955c8eaefc6e84a5a5d9c63cf55f5be359d8','verified','ramzi-flash-authored-20261031','G9-T04-A-Q02א');
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Expected one guarded target row'; end if;
  select count(*),encode(sha256(convert_to(string_agg(concat_ws(chr(31),exercise_id,hint_1,hint_2,hint_3,source_pdf_hash,coalesce(source_native_sha256,''),status,source,source_id),chr(30)order by exercise_id collate "C"),'UTF8')),'hex') into bank_count,core_sha from public.noam_ramzi_hints;
  if bank_count<>31670 or core_sha is distinct from '608051e56ac7fe7cf286651ff1c63a55b9c736ba4f92ec56e8a5685eec6f484e' then raise exception 'Editorial update verification failed'; end if;
end;
$editorial$;
commit;
