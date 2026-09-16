const SEARCH_URL = "https://compras.fiemg.com.br/portal/WebService/Servicos.asmx/PesquisarProcessosPorSituacoesAgrupadas";
const ITEMS_URL = "https://compras.fiemg.com.br/portal/WebService/Servicos.asmx/PesquisarProcessoDetalheItemProduto";
const ATTACHMENTS_URL = "https://compras.fiemg.com.br/portal/WebService/Servicos.asmx/PesquisarAnexos";

function normalizeProcessNumber(value) {
  const clean = String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
  if (/^\d{4,}$/.test(clean)) return clean;
  const typedProcess = clean.match(/^(SDE|CDE)\s*(\d+)$/);
  if (typedProcess) return `${typedProcess[1]} ${typedProcess[2]}`;
  const digits = clean.replace(/\D/g, "");
  return digits ? `SDE ${digits}` : clean;
}

function parsePortalDate(value) {
  const milliseconds = String(value || "").match(/\/Date\((-?\d+)\)\//)?.[1];
  if (!value) return null;
  const date = new Date(milliseconds ? Number(milliseconds) : value);
  return Number.isNaN(date.getTime()) || date.getUTCFullYear() < 2000 ? null : date.toISOString();
}

async function fiemgPost(url, body) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json, text/javascript, */*; q=0.01",
          Referer: "https://compras.fiemg.com.br/portal/mural.aspx",
          "User-Agent": "Mozilla/5.0",
        },
        body,
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        const error = new Error(`Portal FIEMG retornou status ${response.status}.`);
        if (response.status < 500 && response.status !== 429) throw error;
        lastError = error;
      } else {
        const payload = await response.json();
        const data = typeof payload?.d === "string" ? JSON.parse(payload.d) : payload?.d;
        if (data == null) throw new Error("O portal retornou uma resposta inesperada.");
        return data;
      }
    } catch (error) {
      lastError = error;
      if (attempt === 2) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 600 * (2 ** attempt)));
  }
  throw lastError || new Error("Não foi possível consultar o portal FIEMG.");
}

function buildSearchBody({ code = "", pageSize = 20, offset = 0, situation = 0, mural = 4, order = "TDTINICIAL", object = "", year = 0 }) {
  const query = normalizeProcessNumber(code);
  const numericCode = /^\d{4,6}$/.test(query) ? Number(query) : 0;
  const processNumber = numericCode ? "" : query;
  return JSON.stringify({ dtoProcesso: { nAnoFinalizacao: year, tmpTipoMuralProcesso: mural, nCdModulo: 0, nCdModalidade: 0, nCdModalidadeFase: 0, nCdTipoModalidade: 0, tmpTipoMuralVisao: situation, nCdSituacao: situation, nCdTipoProcesso: 0, nCdEmpresa: 0, sNrProcesso: processNumber, nCdProcesso: numericCode, sDsObjeto: object, sDtPeriodoDe: "", sDtPeriodoAte: "", sOrdenarPor: order, sOrdenarPorDirecao: "DESC", dtoPaginacao: { nPaginaDe: offset + 1, nPaginaAte: offset + pageSize }, dtoIdioma: { nCdIdioma: 1 } } });
}

async function searchPage(options) {
  const rows = await fiemgPost(SEARCH_URL, buildSearchBody(options));
  if (!Array.isArray(rows)) throw new Error("Lista de processos FIEMG inválida.");
  return rows;
}

async function fetchDetails(process) {
  return fiemgPost(SEARCH_URL.replace("PesquisarProcessosPorSituacoesAgrupadas", "PesquisarProcessoDetalhes"), JSON.stringify({ dtoProcesso: { nCdProcesso: process.nCdProcesso, nCdModulo: process.nCdModulo, nCdSituacao: process.nCdSituacao, sNrProcesso: process.sNrProcessoDisplay, nCdEdital: process.nCdEdital, tmpTipoMuralProcesso: 4, dtoIdioma: { nCdIdioma: 1 } } }));
}

async function fetchAttachments(process, details) {
  const attachmentId = Number(details?.nCdAnexo || process?.nCdAnexo || 0);
  if (attachmentId <= 0) return [];
  const rows = await fiemgPost(ATTACHMENTS_URL, JSON.stringify({
    dtoAnexo: {
      nCdAnexo: attachmentId,
      sNmLocalAnexo: "EditalAnexos",
      nCdModulo: Number(details?.nCdModulo || process?.nCdModulo || 59),
      nCdOrigem: Number(details?.nCdOrigem || process?.nCdProcesso || 0),
      bFlPublico: 1,
    },
  }));
  return Array.isArray(rows) ? rows : [];
}

function buildItemsBody(process) {
  return JSON.stringify({ dtoProcesso: { nCdProcesso: Number(process.nCdProcesso), nCdModulo: Number(process.nCdModulo || 59), sNrProcesso: String(process.sNrProcessoDisplay || ""), nCdLote: 0, nCdSituacao: Number(process.nCdSituacao || 3), tmpTipoMuralProcesso: 4, dtoIdioma: { nCdIdioma: 1 } } });
}

function cleanText(value) {
  return String(value || "").replace(/[\u0012\u0013]/g, "").replace(/\s+/g, " ").trim();
}

async function hydrateProcess(process, includeItems) {
  const items = includeItems ? await fiemgPost(ITEMS_URL, buildItemsBody(process)) : [];
  const mappedItems = items.map((item) => ({
    externalItemId: Number(item.nCdItem || 0),
    order: Number(item.nCdItemSequencial || 0),
    description: cleanText(item.sDsItem),
    quantity: Number(item.dQtItem || 0),
    unit: cleanText(item.sDsUnidadeMedida),
    referenceUnitPrice: Number(item.dVlReferencia || 0),
    portalStatus: cleanText(item.sStItem),
    phase: cleanText(item.sStFase),
    attachmentId: Number(item.nCdAnexo || 0),
  }));
  const referenceTotal = mappedItems.reduce((sum, item) => sum + item.quantity * item.referenceUnitPrice, 0);
  return {
    externalProcessId: Number(process.nCdProcesso || 0),
    processNumber: cleanText(process.sNrProcessoDisplay),
    object: cleanText(process.sDsObjeto),
    entity: cleanText(process.sNmEmpresa || process.sNmApelido || "SISTEMA FIEMG"),
    modality: cleanText(process.sNmModalidadeTipo || process.sNmModalidade),
    startAt: parsePortalDate(process.tDtInicial),
    deadline: parsePortalDate(process.tDtFinal),
    portalStatus: cleanText(process.sDsSituacao),
    portalGroup: /encerr|finaliz|homolog/i.test(String(process.sDsSituacao || "")) ? "Encerrado" : "Aberto",
    estimatedValue: Number(referenceTotal.toFixed(2)),
    itemCount: mappedItems.length,
    sourceUrl: `https://compras.fiemg.com.br/portal/mural.aspx?sDsProcesso=${encodeURIComponent(process.sNrProcessoDisplay)}&nCdModulo=${process.nCdModulo}`,
    attachmentUrl: "",
    portalModule: Number(process.nCdModulo),
    importedAt: new Date().toISOString(),
    items: mappedItems,
  };
}

async function fetchProcesses({ mode = "sync", code = "", limit = 12, includeItems = true } = {}) {
  const found = await fiemgPost(SEARCH_URL, buildSearchBody({ code: mode === "single" ? code : "", pageSize: mode === "sync" ? limit : 50 }));
  const query = normalizeProcessNumber(code);
  const selected = mode === "sync" ? found.slice(0, limit) : found.filter((process) =>
    normalizeProcessNumber(process.sNrProcessoDisplay) === query || String(process.nCdProcesso) === query
  ).slice(0, 1);
  const processes = [];
  for (let index = 0; index < selected.length; index += 3) {
    processes.push(...await Promise.all(selected.slice(index, index + 3).map((process) => hydrateProcess(process, includeItems))));
  }
  return processes;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const mode = body.mode === "sync" ? "sync" : "single";
    if (mode === "single" && !/^(?:(?:SDE|CDE)\s*)?\d{4,20}$/i.test(String(body.code || "").trim())) {
      res.status(400).json({ error: "Informe um processo SDE/CDE válido." });
      return;
    }
    const limit = Math.min(30, Math.max(1, Number.parseInt(body.limit, 10) || 12));
    const processes = await fetchProcesses({ mode, code: body.code, limit, includeItems: mode === "single" || body.includeItems !== false });
    if (!processes.length) {
      res.status(404).json({ error: "Nenhum processo encontrado no mural público da FIEMG." });
      return;
    }
    res.status(200).json({ ok: true, mode, count: processes.length, processes });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao consultar a FIEMG." });
  }
};
module.exports.fetchProcesses = fetchProcesses;
module.exports.searchPage = searchPage;
module.exports.fetchDetails = fetchDetails;
module.exports.fetchAttachments = fetchAttachments;
module.exports.hydrateProcess = hydrateProcess;
module.exports.parsePortalDate = parsePortalDate;
module.exports.fiemgPost = fiemgPost;
module.exports.normalizeProcessNumber = normalizeProcessNumber;
module.exports.cleanText = cleanText;
