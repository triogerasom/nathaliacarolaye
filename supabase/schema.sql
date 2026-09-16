create extension if not exists pgcrypto;

create table if not exists public.company_app_state (
  company_cnpj text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  company_cnpj text not null,
  access_key text not null,
  direction text not null check (direction in ('entrada', 'saida')),
  number text,
  series text,
  issued_at timestamptz,
  participant_name text,
  participant_cnpj text,
  total numeric(14, 2) default 0,
  xml_original text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (company_cnpj, access_key)
);

create table if not exists public.fiscal_products (
  id uuid primary key default gen_random_uuid(),
  company_cnpj text not null,
  gtin text not null,
  commercial_gtin text,
  description text not null,
  ncm text,
  cest text,
  tax_unit text,
  fiscal_stock numeric(14, 4) not null default 0,
  average_cost numeric(14, 4) not null default 0,
  last_purchase_at timestamptz,
  last_purchase_price numeric(14, 4) not null default 0,
  validity_date date,
  category text,
  brand text,
  origin text,
  cfop text,
  updated_at timestamptz not null default now(),
  unique (company_cnpj, gtin)
);

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

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_cnpj text not null,
  fiscal_document_id uuid references public.fiscal_documents(id) on delete cascade,
  product_gtin text not null,
  direction text not null check (direction in ('entrada', 'saida')),
  quantity numeric(14, 4) not null,
  unit text,
  cfop text,
  value numeric(14, 2) default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
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
  external_process_id bigint,
  process_number text,
  modality text,
  portal_status text,
  portal_group text,
  item_count integer not null default 0,
  deadline date,
  estimated_value numeric(14, 2) not null default 0,
  status text not null default 'Mapeando',
  next_step text,
  source_url text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (company_cnpj, process)
);

create table if not exists public.fiemg_opportunity_items (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.fiemg_opportunities(id) on delete cascade,
  company_cnpj text not null,
  process text not null,
  external_item_id bigint,
  item_order integer,
  description text not null,
  quantity numeric(14, 4) not null default 0,
  unit text,
  reference_unit_price numeric(14, 4) not null default 0,
  portal_status text,
  phase text,
  created_at timestamptz not null default now(),
  unique (company_cnpj, process, external_item_id)
);

alter table public.company_app_state enable row level security;
alter table public.fiscal_documents enable row level security;
alter table public.fiscal_products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.participants enable row level security;
alter table public.commercial_proposals enable row level security;
alter table public.fiemg_opportunities enable row level security;
alter table public.fiemg_opportunity_items enable row level security;

drop policy if exists "authenticated users manage company state" on public.company_app_state;
create policy "authenticated users manage company state"
  on public.company_app_state
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated users manage fiscal documents" on public.fiscal_documents;
create policy "authenticated users manage fiscal documents"
  on public.fiscal_documents
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated users manage fiscal products" on public.fiscal_products;
create policy "authenticated users manage fiscal products"
  on public.fiscal_products
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated users manage stock movements" on public.stock_movements;
create policy "authenticated users manage stock movements"
  on public.stock_movements
  for all
  to authenticated
  using (true)
  with check (true);

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

drop policy if exists "authenticated users manage fiemg opportunity items" on public.fiemg_opportunity_items;
create policy "authenticated users manage fiemg opportunity items"
  on public.fiemg_opportunity_items
  for all
  to authenticated
  using (true)
  with check (true);
