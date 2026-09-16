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

alter table public.fiemg_opportunities
  add column if not exists homologated_at timestamptz,
  add column if not exists regional_match boolean not null default false,
  add column if not exists locations jsonb not null default '[]',
  add column if not exists retention_reason text,
  add column if not exists portal_module integer;

alter table public.fiemg_sync_status add column if not exists coverage jsonb not null default '{}';

create table if not exists public.fiemg_discovery (
  process_key text primary key,
  fingerprint text not null,
  checked_at timestamptz not null,
  homologated_at timestamptz,
  retained boolean not null default false
);
alter table public.fiemg_discovery enable row level security;

create table if not exists public.fiemg_detail_cache (
  cache_key text primary key,
  company_cnpj text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists fiemg_detail_cache_expiry on public.fiemg_detail_cache(expires_at);
alter table public.fiemg_detail_cache enable row level security;
drop policy if exists "owner reads active fiemg cache" on public.fiemg_detail_cache;
create policy "owner reads active fiemg cache" on public.fiemg_detail_cache for select to authenticated
  using (company_cnpj = '68205288000174' and auth.jwt()->>'email' = 'eu15933220620@gmail.com' and expires_at > now());
drop policy if exists "owner inserts fiemg cache" on public.fiemg_detail_cache;
create policy "owner inserts fiemg cache" on public.fiemg_detail_cache for insert to authenticated
  with check (company_cnpj = '68205288000174' and auth.jwt()->>'email' = 'eu15933220620@gmail.com' and expires_at <= now() + interval '24 hours 1 minute');
drop policy if exists "owner updates fiemg cache" on public.fiemg_detail_cache;
create policy "owner updates fiemg cache" on public.fiemg_detail_cache for update to authenticated
  using (company_cnpj = '68205288000174' and auth.jwt()->>'email' = 'eu15933220620@gmail.com')
  with check (company_cnpj = '68205288000174' and auth.jwt()->>'email' = 'eu15933220620@gmail.com' and expires_at <= now() + interval '24 hours 1 minute');
