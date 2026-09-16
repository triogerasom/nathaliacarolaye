/* Presentation and navigation shared by the existing fiscal modules. */
const navigationIcons = { dashboard: "layout-dashboard", importar: "file-up", estoque: "boxes", produtos: "package", documentos: "arrow-left-right", propostas: "file-pen-line", integracoes: "briefcase-business", exportar: "sheet", plataforma: "building-2", auditoria: "history" };
document.querySelectorAll(".nav-item").forEach((button) => {
  const icon = document.createElement("i");
  icon.dataset.lucide = navigationIcons[button.dataset.view];
  button.prepend(icon);
});

const menuToggle = document.getElementById("menu-toggle");
const menuBackdrop = document.getElementById("menu-backdrop");
function toggleMenu(open) {
  document.body.classList.toggle("menu-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  menuBackdrop.hidden = !open;
}
menuToggle.addEventListener("click", () => toggleMenu(!document.body.classList.contains("menu-open")));
menuBackdrop.addEventListener("click", () => toggleMenu(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { toggleMenu(false); menuToggle.focus(); }
});
document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => {
  toggleMenu(false);
  document.getElementById("view-title").focus({ preventScroll: true });
}));
document.getElementById("view-title").tabIndex = -1;

const listFilters = [];
function addListSearch(view, targetId, label, types = false) {
  const target = document.getElementById(targetId);
  const toolbar = document.createElement("div");
  toolbar.className = "table-toolbar";
  toolbar.innerHTML = `<label class="search-field"><i data-lucide="search"></i><input type="search" aria-label="${label}" placeholder="${label}" /></label>${types ? '<select aria-label="Tipo de documento"><option value="">Todos os tipos</option><option value="entrada">Entradas</option><option value="saida">Saídas</option></select>' : ''}<span class="table-count" aria-live="polite"></span>`;
  const container = target.closest(".table-wrap") || target;
  container.before(toolbar);
  const search = toolbar.querySelector("input");
  const type = toolbar.querySelector("select");
  const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const apply = () => {
    const rows = [...target.children].filter((row) => !row.classList.contains("empty-state") && !row.querySelector(".empty-state"));
    let visible = 0;
    rows.forEach((row) => {
      const match = normalize(row.textContent).includes(normalize(search.value)) && (!type?.value || normalize(row.cells?.[0]?.textContent || "") === type.value);
      row.hidden = !match;
      if (match) visible++;
    });
    toolbar.querySelector(".table-count").textContent = `${visible} de ${rows.length} registros`;
  };
  search.addEventListener("input", apply);
  type?.addEventListener("change", apply);
  listFilters.push(apply);
}
addListSearch("estoque", "stock-rows", "Buscar produto, EAN ou NCM");
addListSearch("produtos", "product-cards", "Buscar produto ou EAN");
addListSearch("documentos", "document-rows", "Buscar nota ou participante", true);
addListSearch("integracoes", "fiemg-rows", "Buscar processo, objeto ou entidade");
addListSearch("propostas", "saved-proposal-rows", "Buscar proposta ou cliente");

window.renderWorkspace = function () {
  document.getElementById("overview-date").textContent = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const upcoming = [...(state.fiemg.opportunities || [])].filter((item) => item.status !== "Não participar" && item.portalGroup !== "Encerrado" && (!item.deadline || new Date(`${item.deadline.slice(0, 10)}T23:59:59`) >= new Date())).sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999")).slice(0, 3);
  document.getElementById("dashboard-opportunities").innerHTML = upcoming.length ? upcoming.map((item) => `<article class="opportunity-line"><div><strong>${escapeHtml(item.process)} <small> / ${escapeHtml(item.entity || "FIEMG")}</small></strong><p>${escapeHtml(item.object)}</p></div><time>${formatDate(item.deadline)}</time></article>`).join("") : '<div class="empty-block"><i data-lucide="briefcase-business"></i><strong>Nenhum prazo em acompanhamento</strong><p>As oportunidades com prazo vigente aparecerão aqui.</p></div>';
  const products = Object.values(state.products);
  const today = new Date().toLocaleDateString("en-CA");
  const checks = [
    ["triangle-alert", "Produtos com saldo negativo", products.filter((p) => p.stock < 0).length],
    ["calendar-clock", "Produtos vencidos em estoque", products.filter((p) => p.stock > 0 && p.validity && p.validity < today).length],
    ["calendar-days", "Produtos sem validade informada", products.filter((p) => p.stock > 0 && !p.validity).length],
    ["file-check-2", "Notas de saída importadas", state.documents.filter((d) => d.type === "saida").length],
  ];
  document.getElementById("dashboard-attention").innerHTML = checks.map(([icon, label, count], index) => `<div class="attention-line ${count && index < 3 ? "warning" : ""}"><span><i data-lucide="${icon}"></i>${label}</span><strong>${count}</strong></div>`).join("");
  document.getElementById("audit-rows").innerHTML = state.batches.map((batch) => `<tr><td>${escapeHtml(batch.sourceName)}</td><td>${formatDate(batch.importedAt)}</td><td>${escapeHtml(batch.status)}</td><td>${Number(batch.items || 0)} itens · ${escapeHtml(maskKey(batch.key))}</td></tr>`).join("") || emptyRow(4, "Nenhuma importação registrada.");
  const sync = state.fiemg.serverSync;
  const serverBadge = document.getElementById("server-sync-state");
  const serverDetail = document.getElementById("server-sync-detail");
  const delayed = sync?.last_success_at && Date.now() - Date.parse(sync.last_success_at) > 60 * 60 * 1000;
  serverBadge.classList.toggle("ready", sync?.status === "success" && !delayed);
  serverBadge.textContent = state.fiemg.serverSyncError ? "Consulta indisponível" : !sync ? "Aguardando primeira execução" : sync.status === "running" ? "Sincronizando no servidor" : sync.status === "error" ? "Falha na última execução" : delayed ? "Atualização atrasada" : "Automação ativa";
  const coverage = sync?.coverage || {};
  const retained = Number(coverage.retained ?? sync?.process_count ?? 0);
  const regional = Number(coverage.regional || 0);
  serverDetail.textContent = state.fiemg.serverSyncError || (sync?.last_success_at ? `Última conclusão: ${new Date(sync.last_success_at).toLocaleString("pt-BR")} · ${retained} processos cobertos · ${regional} regionais · ${sync.item_count} itens atualizados.` : sync?.message || "Nenhuma execução automática confirmada ainda.");
  listFilters.forEach((apply) => apply());
  window.lucide?.createIcons();
};

let refreshingFiemg = false;
window.maybeSyncFiemg = async function () {
  if (!state.auth.loggedIn || state.auth.mustChangePassword || document.hidden || fiemgImportBusy || refreshingFiemg) return;
  refreshingFiemg = true;
  try { await loadFiemgRemote(); } finally { refreshingFiemg = false; }
};
setInterval(() => maybeSyncFiemg(), 60 * 1000);
document.addEventListener("visibilitychange", () => maybeSyncFiemg());
renderWorkspace();
