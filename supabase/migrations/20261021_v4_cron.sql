-- Execute DEPOIS de salvar no Vault/Secrets os valores project_url, publishable_key e cron_secret.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin
  perform cron.unschedule('casa-obra-due-reminders');
exception when others then null; end $$;

select cron.schedule(
  'casa-obra-due-reminders',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='project_url') || '/functions/v1/push-notify',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey',(select decrypted_secret from vault.decrypted_secrets where name='publishable_key'),
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='cron_secret')
    ),
    body := '{"mode":"due"}'::jsonb
  );
  $$
);
