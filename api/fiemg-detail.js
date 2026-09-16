const {
  searchPage,
  fetchDetails,
  fetchAttachments,
  hydrateProcess,
  parsePortalDate,
  normalizeProcessNumber,
  cleanText,
} = require("./fiemg-import.js");

function publicDownloadUrl(parameter) {
  if (!String(parameter || "").startsWith("?")) return "";
  return `https://compras.fiemg.com.br/portal/Download.aspx${parameter}`;
}

async function loadProcessDetail(code) {
  const normalized = normalizeProcessNumber(code);
  const rows = await searchPage({ code: normalized, pageSize: 50 });
  const process = rows.find((row) =>
    normalizeProcessNumber(row.sNrProcessoDisplay) === normalized || String(row.nCdProcesso) === normalized
  );
  if (!process) return null;

  const [details, summary] = await Promise.all([
    fetchDetails(process),
    hydrateProcess(process, true),
  ]);
  const attachmentRows = await fetchAttachments(process, details);
  const generatedAt = new Date();
  const expiresAt = new Date(generatedAt.getTime() + 24 * 60 * 60 * 1000);

  return {
    ...summary,
    phase: cleanText(details.sDsFase),
    status: cleanText(details.sDsSituacao || process.sDsSituacao),
    processType: cleanText(details.sDsTipoProcesso),
    startAt: parsePortalDate(details.tDtInicial) || summary.startAt,
    deadline: parsePortalDate(details.tDtFinal) || summary.deadline,
    homologatedAt: parsePortalDate(details.tDtHomologacao),
    finalizedAt: parsePortalDate(details.tDtFinalizacao),
    observation: cleanText(details.sDsObservacao || details.sDsDetalhe || details.sDsDescricao),
    officialPortalUrl: summary.sourceUrl,
    attachments: attachmentRows.map((attachment) => ({
      id: Number(attachment.nSqAnexo || attachment.nCdAnexo || 0),
      description: cleanText(attachment.sDsAnexo || attachment.sNmArquivo || "Documento do processo"),
      filename: cleanText(attachment.sNmArquivo),
      publishedAt: parsePortalDate(attachment.tDtAnexo),
      url: publicDownloadUrl(attachment.sDsParametroCriptografado),
      rectified: Boolean(attachment.bFlRetificacao),
    })).filter((attachment) => attachment.url),
    generatedAt: generatedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }
  const code = String(req.query?.process || "").trim();
  if (!/^(?:(?:SDE|CDE)\s*)?\d{4,20}$/i.test(code)) {
    res.status(400).json({ error: "Informe um processo SDE/CDE válido." });
    return;
  }
  try {
    const process = await loadProcessDetail(code);
    if (!process) {
      res.status(404).json({ error: "Processo não encontrado no mural público da FIEMG." });
      return;
    }
    res.status(200).json({ ok: true, process });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao consultar os detalhes da FIEMG." });
  }
};

module.exports.loadProcessDetail = loadProcessDetail;
