-- Casa & Obra V6 — impede clientes antigos de ressuscitarem dados do reset
create or replace function public.guard_casa_obra_data_epoch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  required_epoch text;
  incoming_epoch text;
begin
  if new.id <> 'casa-obra-shared' then
    return new;
  end if;

  select config_value into required_epoch
  from public.backend_runtime_config
  where name = 'data_epoch';

  if required_epoch is null or required_epoch = '' then
    return new;
  end if;

  incoming_epoch := coalesce(new.data->>'dataEpoch','');
  if incoming_epoch is distinct from required_epoch then
    raise exception 'stale_data_epoch: expected %, got %', required_epoch, incoming_epoch
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_casa_obra_data_epoch on public.app_state;
create trigger trg_guard_casa_obra_data_epoch
before update on public.app_state
for each row execute function public.guard_casa_obra_data_epoch();
