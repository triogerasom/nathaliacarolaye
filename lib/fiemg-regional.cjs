const { createHash } = require('node:crypto');
const { searchPage, fetchDetails, hydrateProcess, parsePortalDate } = require('../api/fiemg-import.js');
const geography = require('./fiemg-region-cities.json');

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}
function regionalLocations(process) {
  const object = ` ${normalize(process.sDsObjeto)} `;
  const buyer = ` ${normalize(process.sNmEmpresa)} `;
  return geography.cities.flatMap((city) => {
    const name = ` ${normalize(city.name)} `;
    const found = object.includes(name);
    if (!found && !buyer.includes(name)) return [];
    const closest = [...city.distances].sort((a, b) => a.km - b.km)[0];
    return [{ municipality: city.name, ibge: city.id, center: closest.center, distanceKm: closest.km, basis: found ? 'municipio_no_objeto' : 'unidade_compradora_a_confirmar', approximate: true }];
  });
}
function monthsAgo(now, months) {
  const date = new Date(now);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  date.setUTCHours(0, 0, 0, 0);
  return date;
}
function withinWindow(value, now) {
  const date = parsePortalDate(value);
  return Boolean(date && new Date(date) >= monthsAgo(now, 8) && new Date(date) <= now);
}

async function collectRegional({ cached = [], now = new Date(), search = searchPage, detail = fetchDetails, hydrate = hydrateProcess, report = console.log } = {}) {
  const cache = new Map(cached.map((row) => [row.process_key, row]));
  const candidates = new Map();
  const seen = new Set();
  let scanned = 0;
  for (let offset = 0; ; offset += 500) {
    const page = await search({ offset, pageSize: 500 });
    if (!page.length) break;
    let newRows = 0;
    for (const row of page) {
      const key = `${row.nCdModulo}:${row.nCdProcesso}`;
      if (seen.has(key)) continue;
      seen.add(key);
      newRows++;
      const locations = regionalLocations(row);
      if (scanned < 100 || locations.length) candidates.set(key, { row, locations, latest: scanned < 100 });
      scanned++;
    }
    if (!newRows) throw new Error('A paginação da FIEMG repetiu registros; varredura interrompida sem declarar cobertura completa.');
    if (offset % 2500 === 0) report(`Mural: ${scanned} processos examinados.`);
    if (page.length < 500) break;
  }
  const processes = [];
  const discovery = [];
  const stats = { scanned, regional: 0, homologated: 0, pendingDates: 0, retained: 0, detailFailures: 0, hydrationFailures: 0, cutoff: monthsAgo(now, 8).toISOString() };
  const entries = [...candidates.entries()];
  for (let start = 0; start < entries.length; start += 3) {
    await Promise.all(entries.slice(start, start + 3).map(async ([key, candidate]) => {
      const { row, locations, latest } = candidate;
      const fingerprint = createHash('sha256').update(JSON.stringify(row)).digest('hex');
      const previous = cache.get(key);
      const fresh = previous?.fingerprint === fingerprint && now - new Date(previous.checked_at) < 86400000;
      const homologated = /^homologad/i.test(row.sDsSituacao);
      let homologatedAt = fresh ? previous.homologated_at : null;
      if (homologated && !fresh) {
        try {
          homologatedAt = parsePortalDate((await detail(row)).tDtHomologacao);
        } catch {
          stats.detailFailures++;
          homologatedAt = null;
        }
      }
      const pendingDate = homologated && !homologatedAt;
      const inRegion = locations.length > 0 && (!homologated || pendingDate || withinWindow(homologatedAt, now));
      const retained = latest || inRegion;
      discovery.push({ process_key: key, fingerprint, checked_at: fresh ? previous.checked_at : now.toISOString(), homologated_at: homologatedAt, retained });
      if (inRegion) stats.regional++;
      if (inRegion && homologated && !pendingDate) stats.homologated++;
      if (inRegion && pendingDate) stats.pendingDates++;
      if (!retained) return;
      stats.retained++;
      // Closed, unchanged regional records are already durable; refresh them daily.
      if (!latest && homologated && fresh && previous.retained) return;
      let process;
      try {
        process = await hydrate(row, true);
      } catch {
        stats.hydrationFailures++;
        process = await hydrate(row, false);
      }
      processes.push({ ...process, homologatedAt, regionalMatch: Boolean(locations.length), locations, retentionReason: latest ? 'ultimos_100' : pendingDate ? 'regional_data_a_confirmar' : homologated ? 'regional_homologado_8_meses' : 'regional', portalModule: row.nCdModulo });
    }));
    if (start % 150 === 0) report(`Região: ${Math.min(start + 3, entries.length)} de ${entries.length} candidatos conferidos.`);
  }
  return { processes, discovery, stats };
}
module.exports = { collectRegional, regionalLocations, monthsAgo, withinWindow };
