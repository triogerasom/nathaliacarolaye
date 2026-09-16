const { spawn } = require('node:child_process');
const { collectRegional } = require('../lib/fiemg-regional.cjs');
const COMPANY_CNPJ = '68205288000174';

function databaseEnv(connection) {
  const url = new URL(connection);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Configure SUPABASE_DB_URL com a conexão PostgreSQL.');
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '20', PGCLIENTENCODING: 'UTF8' };
}
function sqlLiteral(value) { return "'" + String(value).replace(/'/g, "''") + "'"; }
function executeSql(sql, env) {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', ['-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    // Database diagnostics may contain connection details; never forward them to public logs.
    child.stderr.on('data', () => {});
    child.on('error', () => reject(new Error('Não foi possível iniciar o cliente PostgreSQL.')));
    child.on('close', (code) => code === 0 ? resolve(output.trim()) : reject(new Error('Falha ao gravar a sincronização no Supabase.')));
    child.stdin.on('error', () => {});
    child.stdin.end(`SET standard_conforming_strings = on; SET statement_timeout = '180s';\n${sql}`);
  });
}

function syncSql(processes, runUrl, discovery = [], coverage = {}) {
  const payload = sqlLiteral(JSON.stringify(processes));
  const itemCount = processes.reduce((sum, entry) => sum + entry.items.length, 0);
  return `BEGIN;
SELECT pg_advisory_xact_lock(68205288);
CREATE TEMP TABLE incoming_fiemg ON COMMIT DROP AS SELECT value AS doc FROM jsonb_array_elements(${payload}::jsonb);
INSERT INTO public.fiemg_opportunities (company_cnpj, process, object, entity, external_process_id, process_number, modality, portal_status, portal_group, item_count, deadline, estimated_value, status, source_url, imported_at, homologated_at, regional_match, locations, retention_reason, portal_module)
SELECT '${COMPANY_CNPJ}', doc->>'processNumber', doc->>'object', doc->>'entity', (doc->>'externalProcessId')::bigint, doc->>'processNumber', doc->>'modality', doc->>'portalStatus', doc->>'portalGroup', (doc->>'itemCount')::integer, (doc->>'deadline')::timestamptz::date, (doc->>'estimatedValue')::numeric, 'Mapeando', doc->>'sourceUrl', now(), (doc->>'homologatedAt')::timestamptz, coalesce((doc->>'regionalMatch')::boolean,false), coalesce(doc->'locations','[]'::jsonb), doc->>'retentionReason', (doc->>'portalModule')::integer
FROM incoming_fiemg
ON CONFLICT (company_cnpj, process) DO UPDATE SET
 object = excluded.object, entity = excluded.entity, external_process_id = excluded.external_process_id,
 modality = excluded.modality, portal_status = excluded.portal_status, portal_group = excluded.portal_group,
 item_count = excluded.item_count, deadline = excluded.deadline, estimated_value = excluded.estimated_value,
 source_url = excluded.source_url, imported_at = excluded.imported_at,
 homologated_at = excluded.homologated_at, regional_match = excluded.regional_match,
 locations = excluded.locations, retention_reason = excluded.retention_reason, portal_module = excluded.portal_module;
INSERT INTO public.fiemg_opportunity_items (opportunity_id, company_cnpj, process, external_item_id, item_order, description, quantity, unit, reference_unit_price, portal_status, phase)
SELECT opportunity.id, '${COMPANY_CNPJ}', incoming.doc->>'processNumber', (item->>'externalItemId')::bigint, (item->>'order')::integer, item->>'description', (item->>'quantity')::numeric, item->>'unit', (item->>'referenceUnitPrice')::numeric, item->>'portalStatus', item->>'phase'
FROM incoming_fiemg incoming CROSS JOIN LATERAL jsonb_array_elements(incoming.doc->'items') item
JOIN public.fiemg_opportunities opportunity ON opportunity.company_cnpj = '${COMPANY_CNPJ}' AND opportunity.process = incoming.doc->>'processNumber'
ON CONFLICT (company_cnpj, process, external_item_id) DO UPDATE SET
 opportunity_id = excluded.opportunity_id, item_order = excluded.item_order, description = excluded.description,
 quantity = excluded.quantity, unit = excluded.unit, reference_unit_price = excluded.reference_unit_price,
 portal_status = excluded.portal_status, phase = excluded.phase;
INSERT INTO public.fiemg_discovery SELECT * FROM jsonb_populate_recordset(null::public.fiemg_discovery, ${sqlLiteral(JSON.stringify(discovery))}::jsonb)
ON CONFLICT (process_key) DO UPDATE SET fingerprint=excluded.fingerprint, checked_at=excluded.checked_at, homologated_at=excluded.homologated_at, retained=excluded.retained;
DELETE FROM public.fiemg_detail_cache WHERE expires_at <= now();
UPDATE public.fiemg_sync_status SET status = 'success', finished_at = now(), last_success_at = now(), process_count = ${processes.length}, item_count = ${itemCount}, coverage = ${sqlLiteral(JSON.stringify(coverage))}::jsonb, message = 'Sincronização automática concluída', run_url = ${sqlLiteral(runUrl)} WHERE company_cnpj = '${COMPANY_CNPJ}';
COMMIT;
SELECT json_build_object('processes', count(*), 'items', (SELECT count(*) FROM public.fiemg_opportunity_items WHERE company_cnpj = '${COMPANY_CNPJ}')) FROM public.fiemg_opportunities WHERE company_cnpj = '${COMPANY_CNPJ}';`;
}

async function main() {
  const env = databaseEnv(process.env.SUPABASE_DB_URL || '');
  const runUrl = process.env.GITHUB_RUN_ID ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : '';
  await executeSql(`INSERT INTO public.fiemg_sync_status (company_cnpj, status, started_at, message, run_url) VALUES ('${COMPANY_CNPJ}', 'running', now(), 'Consultando mural FIEMG', ${sqlLiteral(runUrl)}) ON CONFLICT (company_cnpj) DO UPDATE SET status = 'running', started_at = now(), message = excluded.message, run_url = excluded.run_url;`, env);
  try {
    await executeSql('DELETE FROM public.fiemg_detail_cache WHERE expires_at <= now();', env);
    const cached = JSON.parse(await executeSql("SELECT coalesce(json_agg(d),'[]'::json) FROM public.fiemg_discovery d;", env));
    const { processes, discovery, stats } = await collectRegional({ cached });
    if (!processes.length) throw new Error('O mural não retornou processos. Os registros existentes foram preservados.');
    for (const entry of processes) {
      if (!entry.processNumber || entry.items.some((item) => !item.externalItemId)) throw new Error('A FIEMG retornou registros sem identificação.');
    }
    const verification = await executeSql(syncSql(processes, runUrl, discovery, stats), env);
    console.log(`Cobertura regional: ${JSON.stringify(stats)}`);
    console.log(`Sincronizados ${processes.length} processos e ${processes.reduce((sum, entry) => sum + entry.items.length, 0)} itens.`);
    console.log(`Verificação no banco: ${verification}`);
  } catch (error) {
    await executeSql(`UPDATE public.fiemg_sync_status SET status = 'error', finished_at = now(), message = 'A sincronização falhou; os dados anteriores foram preservados.' WHERE company_cnpj = '${COMPANY_CNPJ}';`, env).catch(() => {});
    throw error;
  }
}
module.exports = { syncSql, databaseEnv };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
