-- Casa & Obra V6 — reset único da base compartilhada
-- Este arquivo é reaplicável, mas o reset destrutivo acontece uma única vez por data_epoch.

do $$
declare
  target_epoch constant text := 'v6-reset-20261023-1';
  current_epoch text;
  empty_state jsonb := '{
    "tx": [],
    "budget": 0,
    "obraIni": 0,
    "obraDt": "",
    "acc": [],
    "rec": [],
    "pd": {},
    "paypost": {},
    "cash": 0,
    "cashlog": [],
    "alog": [],
    "ev": [],
    "vr": [],
    "vlog": [],
    "walletLedger": [],
    "cashBaseVal": 0,
    "cashBaseDate": "2026-10-23",
    "dataEpoch": "v6-reset-20261023-1",
    "_deleted": {
      "tx": {},
      "rec": {},
      "acc": {},
      "ev": {},
      "vr": {},
      "pd": {},
      "paypost": {},
      "walletLedger": {}
    },
    "_fieldUpdated": {},
    "v5": {
      "projects": [],
      "categoryBudgets": [],
      "cards": [],
      "cardCharges": [],
      "suppliers": [],
      "goals": [],
      "shopping": [],
      "quotes": [],
      "audit": [],
      "trash": [],
      "closedMonths": [],
      "documents": [],
      "notificationPrefs": [],
      "_deleted": {},
      "settings": {},
      "version": "6.0.0"
    }
  }'::jsonb;
begin
  select config_value into current_epoch
  from public.backend_runtime_config
  where name = 'data_epoch';

  if current_epoch is distinct from target_epoch then
    update public.app_state
    set data = empty_state,
        revision = revision + 1,
        device_id = 'system-v6-reset',
        updated_at = now()
    where id = 'casa-obra-shared';

    delete from public.app_state_backups
    where state_id = 'casa-obra-shared';

    delete from public.notification_dispatch_log;

    insert into public.backend_runtime_config(name,config_value,updated_at)
    values ('data_epoch',target_epoch,now())
    on conflict (name) do update
      set config_value = excluded.config_value,
          updated_at = excluded.updated_at;
  end if;
end;
$$;
