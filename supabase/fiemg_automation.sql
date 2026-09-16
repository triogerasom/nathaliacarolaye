create table if not exists public.fiemg_sync_status (
  company_cnpj text primary key,
  status text not null default 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  last_success_at timestamptz,
  process_count integer not null default 0,
  item_count integer not null default 0,
  message text,
  run_url text
);

alter table public.fiemg_sync_status enable row level security;
drop policy if exists "company reads fiemg sync status" on public.fiemg_sync_status;
create policy "company reads fiemg sync status" on public.fiemg_sync_status
  for select to authenticated
  using (company_cnpj = '68205288000174' and auth.jwt()->>'email' = 'eu15933220620@gmail.com');

alter table public.fiemg_opportunities add column if not exists imported_at timestamptz;
