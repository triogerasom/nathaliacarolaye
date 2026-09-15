alter table public.fiscal_products
  add column if not exists last_purchase_at timestamptz,
  add column if not exists last_purchase_price numeric(14, 4) not null default 0,
  add column if not exists validity_date date,
  add column if not exists category text,
  add column if not exists brand text,
  add column if not exists origin text,
  add column if not exists cfop text;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  company_cnpj text not null,
  role text not null check (role in ('fornecedor', 'cliente')),
  document text not null,
  name text not null,
  fantasy_name text,
  state_registration text,
  phone text,
  cep text,
  uf text,
  city text,
  district text,
  street text,
  number text,
  last_document text,
  last_document_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (company_cnpj, role, document)
);

create table if not exists public.commercial_proposals (
  id uuid primary key default gen_random_uuid(),
  company_cnpj text not null,
  number text not null,
  customer_name text not null,
  valid_until date,
  total numeric(14, 2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (company_cnpj, number)
);

create table if not exists public.fiemg_opportunities (
  id uuid primary key default gen_random_uuid(),
  company_cnpj text not null,
  process text not null,
  object text not null,
  entity text,
  deadline date,
  estimated_value numeric(14, 2) not null default 0,
  status text not null default 'Mapeando',
  next_step text,
  source_url text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (company_cnpj, process)
);

alter table public.participants enable row level security;
alter table public.commercial_proposals enable row level security;
alter table public.fiemg_opportunities enable row level security;

drop policy if exists "authenticated users manage participants" on public.participants;
create policy "authenticated users manage participants"
  on public.participants
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated users manage commercial proposals" on public.commercial_proposals;
create policy "authenticated users manage commercial proposals"
  on public.commercial_proposals
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated users manage fiemg opportunities" on public.fiemg_opportunities;
create policy "authenticated users manage fiemg opportunities"
  on public.fiemg_opportunities
  for all
  to authenticated
  using (true)
  with check (true);

-- workflow smoke test 2026-09-15
-- workflow diagnostic test 2026-09-15
-- workflow retest 2026-09-15 19:46:24 -03:00
-- workflow retest direct-db 2026-09-15 19:52:16 -03:00
-- workflow retest pooler 2026-09-15 19:54:11 -03:00
