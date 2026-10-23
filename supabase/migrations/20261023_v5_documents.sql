-- Casa & Obra V5.1 — documentos múltiplos protegidos
-- Idempotente. Mantém o bucket privado e restrito aos dois usuários permitidos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  2097152,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists "receipts_v5_select" on storage.objects;
create policy "receipts_v5_select"
on storage.objects for select to authenticated
using (bucket_id = 'receipts' and public.is_casa_obra_user());

drop policy if exists "receipts_v5_insert" on storage.objects;
create policy "receipts_v5_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'receipts' and public.is_casa_obra_user());

drop policy if exists "receipts_v5_update" on storage.objects;
create policy "receipts_v5_update"
on storage.objects for update to authenticated
using (bucket_id = 'receipts' and public.is_casa_obra_user())
with check (bucket_id = 'receipts' and public.is_casa_obra_user());

drop policy if exists "receipts_v5_delete" on storage.objects;
create policy "receipts_v5_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'receipts' and public.is_casa_obra_user());
