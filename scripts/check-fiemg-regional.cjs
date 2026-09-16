const assert = require('node:assert/strict');
const { collectRegional } = require('../lib/fiemg-regional.cjs');

const now = new Date('2026-09-16T12:00:00Z');
const rows = Array.from({ length: 105 }, (_, index) => ({
  nCdModulo: 59,
  nCdProcesso: 20000 + index,
  nCdSituacao: 3,
  nCdEdital: 30000 + index,
  sNrProcessoDisplay: `SDE 2026${String(index).padStart(6, '0')}`,
  sDsObjeto: `Aquisição geral fora da região ${index}`,
  sNmEmpresa: 'SESI/DRMG - SEDE',
  sDsSituacao: 'Em andamento',
}));

rows[100].sDsObjeto = 'Entrega de materiais em Ipatinga / MG';
rows[101].sDsObjeto = 'Fornecimento em Governador Valadares / MG';
rows[101].sDsSituacao = 'Homologado';
rows[102].sDsObjeto = 'Fornecimento em Timóteo / MG';
rows[102].sDsSituacao = 'Homologado';
rows[103].sDsObjeto = 'Fornecimento em Belo Horizonte / MG';
rows[104].sDsObjeto = 'Entrega em Coronel Fabriciano / MG';
rows[104].sDsSituacao = 'Homologado';

const homologationDates = new Map([
  [rows[101].nCdProcesso, new Date('2026-02-20T12:00:00Z')],
  [rows[102].nCdProcesso, new Date('2025-12-10T12:00:00Z')],
]);

(async () => {
  const result = await collectRegional({
    now,
    report: () => {},
    search: async ({ offset }) => offset === 0 ? rows : [],
    detail: async (row) => ({ tDtHomologacao: homologationDates.has(row.nCdProcesso) ? `/Date(${homologationDates.get(row.nCdProcesso).getTime()})/` : null }),
    hydrate: async (row) => ({ processNumber: row.sNrProcessoDisplay, items: [] }),
  });

  const retained = new Set(result.processes.map((item) => item.processNumber));
  assert.equal(result.stats.scanned, 105);
  assert.equal(result.stats.retained, 103);
  assert(retained.has(rows[100].sNrProcessoDisplay), 'regional open process must be retained');
  assert(retained.has(rows[101].sNrProcessoDisplay), 'regional homologated process inside 8 months must be retained');
  assert(!retained.has(rows[102].sNrProcessoDisplay), 'regional homologated process older than 8 months must be excluded');
  assert(!retained.has(rows[103].sNrProcessoDisplay), 'outside-region process beyond latest 100 must be excluded');
  assert(retained.has(rows[104].sNrProcessoDisplay), 'regional process with pending homologation date must be retained for review');
  assert.equal(result.stats.pendingDates, 1);
  console.log(JSON.stringify({ result: 'passed', scanned: result.stats.scanned, retained: result.stats.retained, regional: result.stats.regional }));
})().catch((error) => { console.error(error); process.exit(1); });
