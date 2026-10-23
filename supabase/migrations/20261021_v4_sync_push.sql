-- Casa & Obra v4 — sincronização robusta + Web Push
-- Pode ser executado mais de uma vez.

alter table public.app_state add column if not exists revision bigint not null default 0;
alter table public.app_state add column if not exists device_id text;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  device_id text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions drop constraint if exists push_subscriptions_endpoint_key;
create unique index if not exists push_subscriptions_user_endpoint_uidx
  on public.push_subscriptions (user_id, endpoint);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_own_select" on public.push_subscriptions;
create policy "push_own_select" on public.push_subscriptions for select to authenticated
using (auth.uid() = user_id and public.is_casa_obra_user());

drop policy if exists "push_own_insert" on public.push_subscriptions;
create policy "push_own_insert" on public.push_subscriptions for insert to authenticated
with check (auth.uid() = user_id and public.is_casa_obra_user());

drop policy if exists "push_own_update" on public.push_subscriptions;
create policy "push_own_update" on public.push_subscriptions for update to authenticated
using (auth.uid() = user_id and public.is_casa_obra_user())
with check (auth.uid() = user_id and public.is_casa_obra_user());

drop policy if exists "push_own_delete" on public.push_subscriptions;
create policy "push_own_delete" on public.push_subscriptions for delete to authenticated
using (auth.uid() = user_id and public.is_casa_obra_user());

create table if not exists public.notification_dispatch_log (
  dedupe_key text primary key,
  created_at timestamptz not null default now()
);


create table if not exists public.backend_runtime_config (
  name text primary key,
  config_value text not null,
  updated_at timestamptz not null default now()
);
alter table public.backend_runtime_config enable row level security;
revoke all on table public.backend_runtime_config from anon, authenticated;
