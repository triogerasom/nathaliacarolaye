const COMPANY_CNPJ = "68205288000174";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });
const params = new URLSearchParams(location.search);
const processCode = String(params.get("process") || "").trim();

function formatDate(value, includeTime = false) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return includeTime ? date.toLocaleString("pt-BR") : date.toLocaleDateString("pt-BR");
}

function fail(message) {
  document.getElementById("detail-loading").hidden = true;
  document.getElementById("detail-content").hidden = true;
  document.getElementById("detail-error").hidden = false;
  document.getElementById("detail-error-message").textContent = message;
  window.lucide?.createIcons();
}

function attachmentNode(attachment) {
  const article = document.createElement("article");
  article.className = "attachment-row";
  const icon = document.createElement("i");
  icon.dataset.lucide = "file-down";
  const text = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = attachment.description || attachment.filename || "Documento do processo";
  const meta = document.createElement("small");
  meta.textContent = `${formatDate(attachment.publishedAt)}${attachment.rectified ? " · Retificado" : ""}`;
  text.append(title, meta);
  const link = document.createElement("a");
  link.className = "secondary link-button";
  link.href = attachment.url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "Baixar";
  article.append(icon, text, link);
  return article;
}

function render(payload, cacheSource) {
  document.title = `${payload.processNumber} | Nathalia Carolayne`;
  document.getElementById("detail-status").textContent = payload.status || payload.portalStatus || "FIEMG";
  document.getElementById("detail-cache").textContent = `${cacheSource === "cache" ? "Cache de 24h" : "Consulta atual"} · ${formatDate(payload.generatedAt, true)}`;
  document.getElementById("detail-process").textContent = payload.processNumber;
  document.getElementById("detail-object").textContent = payload.object || "Objeto não informado.";
  document.getElementById("detail-entity").textContent = payload.entity || "SISTEMA FIEMG";
  document.getElementById("detail-modality").textContent = payload.modality || "Não informada";
  document.getElementById("detail-phase").textContent = payload.phase || "Não informada";
  document.getElementById("detail-start").textContent = formatDate(payload.startAt);
  document.getElementById("detail-deadline").textContent = formatDate(payload.deadline);
  document.getElementById("detail-homologated").textContent = formatDate(payload.homologatedAt);
  document.getElementById("official-link").href = payload.officialPortalUrl || "https://compras.fiemg.com.br/portal/mural.aspx";

  const attachments = payload.attachments || [];
  document.getElementById("attachment-count").textContent = `${attachments.length} documento${attachments.length === 1 ? "" : "s"}`;
  const attachmentList = document.getElementById("attachment-list");
  attachmentList.replaceChildren(...(attachments.length ? attachments.map(attachmentNode) : []));
  if (!attachments.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "A FIEMG não publicou um anexo para este processo.";
    attachmentList.append(empty);
  }

  const items = payload.items || [];
  document.getElementById("item-count").textContent = `${items.length} ite${items.length === 1 ? "m" : "ns"}`;
  const itemBody = document.getElementById("detail-items");
  itemBody.replaceChildren();
  items.forEach((item, index) => {
    const row = document.createElement("tr");
    [item.order || index + 1, item.description || "-", number.format(item.quantity || 0), item.unit || "-", money.format(item.referenceUnitPrice || 0), item.portalStatus || item.phase || "-"].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    itemBody.append(row);
  });
  if (!items.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "empty-state";
    cell.textContent = "Nenhum item público retornado pela FIEMG.";
    row.append(cell);
    itemBody.append(row);
  }

  document.getElementById("detail-loading").hidden = true;
  document.getElementById("detail-content").hidden = false;
  window.lucide?.createIcons();
}

async function main() {
  if (!/^(?:(?:SDE|CDE)\s*)?\d{4,20}$/i.test(processCode)) return fail("O número do processo é inválido.");
  try {
    const configResponse = await fetch("/api/config", { cache: "no-store" });
    const config = await configResponse.json();
    if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error("A conexão da plataforma não está disponível.");
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return fail("Entre na plataforma antes de consultar os detalhes do processo.");

    const cacheKey = `fiemg:${processCode.toUpperCase().replace(/\s+/g, " ")}`;
    const { data: cached } = await supabase.from("fiemg_detail_cache").select("payload,expires_at").eq("cache_key", cacheKey).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (cached?.payload) return render(cached.payload, "cache");

    const response = await fetch(`/api/fiemg-detail?process=${encodeURIComponent(processCode)}`, { cache: "no-store", signal: AbortSignal.timeout(90000) });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error || "A FIEMG não retornou os detalhes do processo.");
    await supabase.from("fiemg_detail_cache").upsert({
      cache_key: cacheKey,
      company_cnpj: COMPANY_CNPJ,
      payload: result.process,
      created_at: result.process.generatedAt,
      expires_at: result.process.expiresAt,
    });
    render(result.process, "live");
  } catch (error) {
    fail(error.message || "Não foi possível consultar este processo agora.");
  }
}

window.lucide?.createIcons();
main();
