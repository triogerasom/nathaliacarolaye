const COMPANY = {
  cnpj: "68205288000174",
  cnpjMasked: "68.205.288/0001-74",
  name: "68.205.288 NATHALIA CAROLAYNE DIAS ARAUJ",
  ie: "0056002090061",
  uf: "MG",
};

const AUTH_EMAIL = "eu15933220620@gmail.com";
const INITIAL_PASSWORD_HASH = "9ee9988554a1e60b2b53c3478979dab72977d77ba42fee4432b4114ea8e7549e";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

const SEBRAE_PRODUCT_HEADERS = [
  "CODIGO DE BARRAS", "TIPO DE PRODUTO", "DESCRICAO", "PRECO DE CUSTO",
  "PRECO VENDA VAREJO", "PRECO VENDA ATACADO", "QUANTIDADE MINIMA ATACADO",
  "UNIDADE", "ATIVO", "CATEGORIA DO PRODUTO", "SUBCATEGORIA DO PRODUTO",
  "MOVIMENTA ESTOQUE", "ESTOQUE MINIMO", "QUANTIDADE EM ESTOQUE", "MARCA",
  "MODELO", "CODIGO BALANCA", "CODIGO INTERNO", "TAGS", "TIPO", "NCM",
  "CFOP", "ORIGEM", "CEST",
];

const initialState = {
  user: "Nathalia",
  auth: { email: AUTH_EMAIL, passwordHash: INITIAL_PASSWORD_HASH, mustChangePassword: true, loggedIn: false },
  documents: [],
  products: {},
  movements: [],
  batches: [],
  suppliers: {},
  customers: {},
  proposals: [],
  currentProposal: { customer: "", validity: "", items: [] },
  fiemg: {
    opportunities: [],
    items: {},
    lastSyncAt: "",
    lastSyncMessage: "",
  },
};

let state = loadState();
let supabaseClient = null;
let supabaseReady = false;
let deferredInstallPrompt;
let fiemgImportBusy = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function loadState() {
  const saved = localStorage.getItem("nathaliaFiscalState");
  const loaded = saved ? JSON.parse(saved) : {};
  return {
    ...structuredClone(initialState),
    ...loaded,
    auth: { ...structuredClone(initialState.auth), ...(loaded.auth || {}) },
    documents: loaded.documents || [],
    products: loaded.products || {},
    movements: loaded.movements || [],
    batches: loaded.batches || [],
    suppliers: loaded.suppliers || {},
    customers: loaded.customers || {},
    proposals: loaded.proposals || [],
    fiemg: {
      ...structuredClone(initialState.fiemg),
      ...(loaded.fiemg || {}),
      opportunities: loaded.fiemg?.opportunities || [],
      items: loaded.fiemg?.items || {},
    },
    currentProposal: {
      ...structuredClone(initialState.currentProposal),
      ...(loaded.currentProposal || {}),
      items: loaded.currentProposal?.items || [],
    },
  };
}

function saveState() {
  localStorage.setItem("nathaliaFiscalState", JSON.stringify(state));
  saveRemoteState();
}

function text(node, tag) {
  const value = node?.getElementsByTagName(tag)?.[0]?.textContent;
  return value ? value.trim() : "";
}

function toNumber(value) {
  const parsed = Number.parseFloat(String(value || "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

function isoDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function maskKey(key) {
  return key ? `${key.slice(0, 6)}...${key.slice(-6)}` : "-";
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isPackageUnit(value) {
  return /^(CX|CAIXA|FD|FARDO|PCT|PACOTE|KIT|DISPLAY|DP|PACK)$/i.test(String(value || "").trim());
}

function packageCountFromDescription(description) {
  const value = String(description || "").toUpperCase();
  const patterns = [
    /(?:CX|CAIXA|FD|FARDO|PCT|PACOTE|KIT|DISPLAY|PACK)\s*(?:C\/|COM|DE)?\s*(\d{1,4})\s*(?:UN|UND|UNID|UNIDADES)\b/,
    /\b(\d{1,4})\s*[Xx]\s*(?:UN|UND|UNID|UNIDADES)\b/,
    /\bC\/?\s*(\d{1,4})\s*(?:UN|UND|UNID|UNIDADES)\b/,
  ];
  for (const pattern of patterns) {
    const count = Number(value.match(pattern)?.[1] || 0);
    if (count > 1 && count <= 1000) return count;
  }
  return 0;
}

function fiscalConversion({ description, uCom, qCom, uTrib, qTrib, vProd, vUnTrib }) {
  const xmlFactor = qCom > 0 ? qTrib / qCom : 1;
  const descriptionFactor = isPackageUnit(uCom) ? packageCountFromDescription(description) : 0;
  const usesXmlConversion = xmlFactor > 1.000001;
  const factor = usesXmlConversion ? xmlFactor : descriptionFactor || Math.max(xmlFactor, 1);
  const fiscalQuantity = qCom > 0 ? qCom * factor : qTrib;
  const fiscalUnit = usesXmlConversion && uTrib && !isPackageUnit(uTrib) ? uTrib : factor > 1 ? "UN" : (uTrib || uCom || "UN");
  return {
    conversion: factor,
    fiscalQuantity,
    fiscalUnit,
    unitCost: fiscalQuantity > 0 ? vProd / fiscalQuantity : vUnTrib || 0,
    conversionSource: usesXmlConversion ? "xml" : descriptionFactor ? "descricao" : "sem_conversao",
    conversionNeedsReview: isPackageUnit(uCom) && !usesXmlConversion,
  };
}

function allocateFinalInvoiceValues(document) {
  const items = document.items || [];
  if (!items.length) return;
  const productSubtotal = items.reduce((sum, item) => sum + Number(item.vProd || 0), 0);
  const weights = items.map((item) => Math.max(Number(item.vProd || 0) - Number(item.vDesc || 0), 0));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const finalTotal = Number(document.total || 0) > 0 ? Number(document.total) : productSubtotal;
  const lastWeightedIndex = weightTotal > 0 ? weights.reduce((last, value, index) => value > 0 ? index : last, 0) : items.length - 1;
  let allocated = 0;

  items.forEach((item, index) => {
    const weight = weightTotal > 0 ? weights[index] / weightTotal : 1 / items.length;
    const finalValue = index === lastWeightedIndex ? roundCurrency(finalTotal - allocated) : roundCurrency(finalTotal * weight);
    allocated = roundCurrency(allocated + finalValue);
    item.finalInvoiceValue = finalValue;
    item.invoiceAdjustment = roundCurrency(finalValue - Number(item.vProd || 0));
    if (document.type === "entrada") {
      const quantity = Number(item.fiscalQuantity || item.qTrib || item.qCom || 0);
      item.finalPurchaseTotal = finalValue;
      item.unitCost = quantity > 0 ? finalValue / quantity : 0;
    } else {
      const quantity = Number(item.qTrib || item.qCom || 0);
      item.finalSaleTotal = finalValue;
      item.unitSalePrice = quantity > 0 ? finalValue / quantity : 0;
    }
  });

  document.productsSubtotal = productSubtotal;
  document.finalAdjustment = roundCurrency(finalTotal - productSubtotal);
}

function validGtin(value) {
  const digits = onlyDigits(value);
  return [8, 12, 13, 14].includes(digits.length) && !/^0+$/.test(digits) ? digits : "";
}

function normalizedProductWords(value) {
  const ignored = new Set(["A", "O", "DE", "DA", "DO", "DAS", "DOS", "COM", "C", "CX", "CAIXA", "FD", "FARDO", "PCT", "PACOTE", "UN", "UND", "UNID", "UNIDADE", "UNIDADES", "LT", "LATA", "GARRAFA", "PET", "PACK", "FRIDGE", "DRINK"]);
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().split(/\s+/).filter((word) => word.length > 1 && !ignored.has(word) && !/^\d+(?:ML|L|G|KG)?$/.test(word));
}

function productMatchScore(item, product) {
  const source = new Set(normalizedProductWords(item.description));
  const target = new Set(normalizedProductWords(product.description));
  if (!source.size || !target.size) return { score: 0, common: 0, coverage: 0 };
  const common = [...source].filter((word) => target.has(word)).length;
  const coverage = common / Math.min(source.size, target.size);
  const dice = (2 * common) / (source.size + target.size);
  const ncmBonus = item.ncm && product.ncm && item.ncm === product.ncm ? 0.08 : 0;
  return { score: Math.min(1, coverage * 0.65 + dice * 0.35 + ncmBonus), common, coverage };
}

function fallbackProductKey(item) {
  const code = String(item.code || "").trim();
  const description = normalizedProductWords(item.description).join("-").slice(0, 80) || "PRODUTO";
  return `SEMGTIN:${code || description}`;
}

function resolveProductKey(item, products, direction) {
  const gtin = validGtin(item.eanTrib) || validGtin(item.ean);
  if (gtin && products[gtin]) return { key: gtin, source: "gtin" };
  if (direction === "entrada") return { key: gtin || fallbackProductKey(item), source: gtin ? "gtin" : "cadastro_sem_gtin" };
  const candidates = Object.values(products).filter((product) => product.purchaseHistory?.length);
  const ranked = candidates.map((product) => ({ product, ...productMatchScore(item, product) })).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (best && best.common >= 2 && best.coverage >= 0.66 && best.score >= 0.72) return { key: best.product.key, source: "descricao_ncm" };
  return { key: gtin || fallbackProductKey(item), source: gtin ? "gtin_novo" : "nao_conciliado" };
}

function rebuildFiscalLedger() {
  if (!state.documents?.length) return;
  const previousProducts = state.products || {};
  const products = {};
  const movements = [];
  const suppliers = {};
  const customers = {};
  const documents = [...state.documents].sort((a, b) => {
    const dateOrder = String(a.issuedAt || "").localeCompare(String(b.issuedAt || ""));
    return dateOrder || (a.type === b.type ? 0 : a.type === "entrada" ? -1 : 1);
  });

  documents.forEach((document) => {
    allocateFinalInvoiceValues(document);
    if (document.type === "entrada" && document.emit) suppliers[document.emit.cnpj || document.emit.name] = { ...document.emit, lastDocument: document.number, lastDate: document.issuedAt };
    if (document.type === "saida" && document.dest) customers[document.dest.cnpj || document.dest.name] = { ...document.dest, lastDocument: document.number, lastDate: document.issuedAt };
    document.items.forEach((item, itemIndex) => {
      if (document.type === "entrada" && (!item.fiscalQuantity || !item.unitCost)) {
        Object.assign(item, fiscalConversion(item));
      }
      const resolution = resolveProductKey(item, products, document.type);
      const preserved = previousProducts[resolution.key] || {};
      const gtin = validGtin(item.eanTrib) || validGtin(item.ean);
      const product = products[resolution.key] || {
        key: resolution.key,
        ean: gtin || preserved.ean || "SEM GTIN",
        eanTrib: gtin || preserved.eanTrib || "SEM GTIN",
        internalCode: item.code || preserved.internalCode || "",
        description: item.description || preserved.description || "Produto sem descrição",
        ncm: item.ncm || preserved.ncm || "",
        cest: item.cest || preserved.cest || "",
        uTrib: item.uTrib || preserved.uTrib || "UN",
        stock: 0,
        averageCost: 0,
        totalCost: 0,
        documents: 0,
        lastPurchase: "",
        lastPurchasePrice: 0,
        validity: preserved.validity || "",
        purchaseHistory: [],
        saleHistory: [],
        salePrice: Number(preserved.salePrice || 0),
        category: preserved.category || "Mercadorias",
        brand: preserved.brand || "",
        origin: preserved.origin || "NACIONAL",
        cfop: item.cfop || preserved.cfop || "",
        aliases: [...(preserved.aliases || [])],
      };

      item.productKey = resolution.key;
      item.matchSource = resolution.source;
      if (document.type === "entrada") {
        const quantity = Number(item.fiscalQuantity || item.qTrib || item.qCom || 0);
        const purchaseTotal = Number(item.finalPurchaseTotal ?? item.vProd ?? 0);
        const unitCost = quantity > 0 ? purchaseTotal / quantity : Number(item.unitCost || item.vUnTrib || item.vUnCom || 0);
        const stockBefore = Math.max(Number(product.stock || 0), 0);
        const valueBefore = stockBefore * Number(product.averageCost || product.lastPurchasePrice || 0);
        product.stock += quantity;
        product.averageCost = stockBefore + quantity > 0 ? (valueBefore + purchaseTotal) / (stockBefore + quantity) : unitCost;
        product.totalCost += purchaseTotal;
        product.documents += 1;
        product.lastPurchase = document.issuedAt;
        product.lastPurchasePrice = unitCost;
        product.description = item.description || product.description;
        product.ncm = item.ncm || product.ncm;
        product.cest = item.cest || product.cest;
        product.uTrib = item.fiscalUnit || item.uTrib || product.uTrib;
        product.cfop = item.cfop || product.cfop;
        product.purchaseHistory.unshift({ date: document.issuedAt, supplier: document.emit?.name || "", supplierCnpj: document.emit?.cnpj || "", quantity, unitCost, total: purchaseTotal, productValue: Number(item.vProd || 0), invoiceAdjustment: Number(item.invoiceAdjustment || 0), documentKey: document.key, itemIndex, commercialQuantity: item.qCom, commercialUnit: item.uCom, conversion: item.conversion || 1 });
        movements.push({ id: `${document.key}:${itemIndex}`, date: document.issuedAt, type: "entrada", productKey: resolution.key, product: product.description, quantity, unit: product.uTrib, commercialQuantity: item.qCom, commercialUnit: item.uCom, conversion: item.conversion || 1, unitCost, costTotal: purchaseTotal, productValue: Number(item.vProd || 0), invoiceAdjustment: Number(item.invoiceAdjustment || 0), revenue: 0, grossProfit: 0, itemIndex, documentKey: document.key, documentNumber: document.number, participant: document.emit?.name || document.participant, cfop: item.cfop, value: purchaseTotal });
      } else {
        const quantity = Number(item.qTrib || item.qCom || 0);
        const revenue = Number(item.finalSaleTotal ?? item.vProd ?? 0);
        const unitSalePrice = quantity > 0 ? revenue / quantity : Number(item.vUnTrib || item.vUnCom || 0);
        const unitCost = Number(product.averageCost || product.lastPurchasePrice || 0);
        const costTotal = quantity * unitCost;
        const grossProfit = revenue - costTotal;
        product.stock -= quantity;
        product.salePrice = unitSalePrice || product.salePrice;
        product.saleHistory.unshift({ date: document.issuedAt, customer: document.dest?.name || "", quantity, unitSalePrice, unitCost, revenue, costTotal, grossProfit, documentKey: document.key, itemIndex });
        if (item.description && item.description !== product.description && !product.aliases.includes(item.description)) product.aliases.push(item.description);
        movements.push({ id: `${document.key}:${itemIndex}`, date: document.issuedAt, type: "saida", productKey: resolution.key, product: product.description, sourceDescription: item.description, matchSource: resolution.source, quantity: -quantity, unit: product.uTrib || item.uTrib, commercialQuantity: item.qCom, commercialUnit: item.uCom, conversion: item.conversion || 1, unitCost, unitSalePrice, costTotal, revenue, grossProfit, itemIndex, documentKey: document.key, documentNumber: document.number, participant: document.dest?.name || document.participant, cfop: item.cfop, value: revenue });
      }
      products[resolution.key] = product;
    });
  });
  state.products = products;
  state.movements = movements.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  state.suppliers = suppliers;
  state.customers = customers;
}

function participantFrom(node) {
  const address = node?.getElementsByTagName("enderEmit")?.[0] || node?.getElementsByTagName("enderDest")?.[0];
  return {
    cnpj: text(node, "CNPJ") || text(node, "CPF"),
    name: text(node, "xNome"),
    fantasyName: text(node, "xFant"),
    ie: text(node, "IE"),
    phone: text(address, "fone"),
    street: text(address, "xLgr"),
    number: text(address, "nro"),
    district: text(address, "xBairro"),
    city: text(address, "xMun"),
    uf: text(address, "UF"),
    cep: text(address, "CEP"),
  };
}

async function hashPassword(password) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function initSupabase() {
  try {
    const configResponse = await fetch("/api/config", { cache: "no-store" });
    if (!configResponse.ok) return;
    const config = await configResponse.json();
    if (!config.supabaseUrl || !config.supabaseAnonKey) return;
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    supabaseReady = true;
    const { data } = await supabaseClient.auth.getSession();
    const user = data.session?.user;
    if (user) {
      state.auth.email = user.email || AUTH_EMAIL;
      state.auth.loggedIn = true;
      state.auth.mustChangePassword = Boolean(user.user_metadata?.must_change_password);
      await loadRemoteState();
      saveState();
    }
  } catch (error) {
    supabaseReady = false;
  } finally {
    renderAuth();
    render();
  }
}

async function loadRemoteState() {
  if (!supabaseReady || !supabaseClient) return;
  const { data, error } = await supabaseClient
    .from("company_app_state")
    .select("data")
    .eq("company_cnpj", COMPANY.cnpj)
    .maybeSingle();
  if (!error && data?.data) state = { ...state, ...data.data, auth: { ...state.auth, ...(data.data.auth || {}), loggedIn: true } };
  state.fiemg = { ...structuredClone(initialState.fiemg), ...(state.fiemg || {}) };
  rebuildFiscalLedger();
  await loadFiemgRemote(true);
}

async function loadFiemgRemote(force = false) {
  if (!supabaseReady || !supabaseClient || !state.auth.loggedIn) return;
  const { data: sync, error: syncError } = await supabaseClient.from("fiemg_sync_status").select("*").eq("company_cnpj", COMPANY.cnpj).maybeSingle();
  if (syncError) {
    state.fiemg.serverSyncError = "Não foi possível consultar a automação no servidor.";
    window.renderWorkspace?.();
    return;
  }
  const previousSuccess = state.fiemg.serverSync?.last_success_at;
  state.fiemg.serverSync = sync;
  state.fiemg.serverSyncError = "";
  if (!force && previousSuccess && previousSuccess === sync?.last_success_at) { window.renderWorkspace?.(); return; }
  async function readRows(table) {
    const rows = [];
    for (let start = 0; ; start += 1000) {
      const { data, error } = await supabaseClient.from(table).select("*").eq("company_cnpj", COMPANY.cnpj).order("id").range(start, start + 999);
      if (error) throw new Error("Não foi possível carregar os processos salvos no servidor.");
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  }
  try {
    const [opportunities, items] = await Promise.all([readRows("fiemg_opportunities"), readRows("fiemg_opportunity_items")]);
    const merged = new Map(state.fiemg.opportunities.map((entry) => [entry.process, entry]));
    opportunities.forEach((row) => merged.set(row.process, {
      ...(merged.get(row.process) || {}), id: row.id, process: row.process, processNumber: row.process_number,
      object: row.object, entity: row.entity, externalProcessId: row.external_process_id, modality: row.modality,
      deadline: row.deadline, estimatedValue: Number(row.estimated_value), status: row.status,
      nextStep: row.next_step, sourceUrl: row.source_url, createdAt: row.created_at,
      portalStatus: row.portal_status, portalGroup: row.portal_group, itemCount: row.item_count, importedAt: row.imported_at,
      homologatedAt: row.homologated_at, regionalMatch: Boolean(row.regional_match), locations: row.locations || [],
      retentionReason: row.retention_reason || "", portalModule: row.portal_module || null,
    }));
    state.fiemg.opportunities = [...merged.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const grouped = {};
    items.forEach((row) => (grouped[row.process] ||= []).push({ externalItemId: row.external_item_id, order: row.item_order, description: row.description, quantity: Number(row.quantity), unit: row.unit, referenceUnitPrice: Number(row.reference_unit_price), portalStatus: row.portal_status, phase: row.phase }));
    Object.values(grouped).forEach((parts) => parts.sort((a, b) => a.order - b.order));
    state.fiemg.items = { ...state.fiemg.items, ...grouped };
    localStorage.setItem("nathaliaFiscalState", JSON.stringify(state));
    renderFiemg();
    renderKpis();
    window.renderWorkspace?.();
  } catch (error) {
    state.fiemg.serverSyncError = error.message;
    state.fiemg.serverSync = { ...sync, last_success_at: previousSuccess };
    window.renderWorkspace?.();
  }
}

async function saveRemoteState() {
  if (!supabaseReady || !supabaseClient || !state.auth.loggedIn) return;
  const { data: userData } = await supabaseClient.auth.getUser();
  // FIEMG is stored separately so a browser snapshot cannot overwrite server imports.
  const { fiemg, ...appState } = state;
  const payload = { ...appState, auth: { ...state.auth, loggedIn: false } };
  await supabaseClient.from("company_app_state").upsert({
    company_cnpj: COMPANY.cnpj,
    data: payload,
    updated_by: userData.user?.id || null,
    updated_at: new Date().toISOString(),
  });
}

async function saveFiemgOpportunityRemote(opportunity) {
  if (!supabaseReady || !supabaseClient || !state.auth.loggedIn) return;
  const { data: userData } = await supabaseClient.auth.getUser();
  const { error } = await supabaseClient.from("fiemg_opportunities").upsert({
    company_cnpj: COMPANY.cnpj,
    process: opportunity.process,
    object: opportunity.object,
    entity: opportunity.entity || null,
    external_process_id: opportunity.externalProcessId || null,
    process_number: opportunity.processNumber || opportunity.process,
    modality: opportunity.modality || null,
    portal_status: opportunity.portalStatus || null,
    portal_group: opportunity.portalGroup || null,
    item_count: opportunity.itemCount || 0,
    deadline: opportunity.deadline || null,
    estimated_value: opportunity.estimatedValue || 0,
    status: opportunity.status,
    next_step: opportunity.nextStep || null,
    source_url: opportunity.sourceUrl,
    imported_at: opportunity.importedAt || new Date().toISOString(),
    homologated_at: opportunity.homologatedAt || null,
    regional_match: Boolean(opportunity.regionalMatch),
    locations: opportunity.locations || [],
    retention_reason: opportunity.retentionReason || null,
    portal_module: opportunity.portalModule || null,
    created_by: userData.user?.id || null,
  }, { onConflict: "company_cnpj,process" });
  if (error) throw new Error("Processo mantido neste dispositivo; falha ao salvar na nuvem.");
}

async function saveFiemgItemsRemote(opportunity, items = []) {
  if (!supabaseReady || !supabaseClient || !state.auth.loggedIn || !items.length) return;
  const rows = items.map((item) => ({
    company_cnpj: COMPANY.cnpj,
    process: opportunity.process,
    external_item_id: item.externalItemId || null,
    item_order: item.order || null,
    description: item.description || "",
    quantity: item.quantity || 0,
    unit: item.unit || null,
    reference_unit_price: item.referenceUnitPrice || 0,
    portal_status: item.portalStatus || null,
    phase: item.phase || null,
  }));
  const { error } = await supabaseClient.from("fiemg_opportunity_items").upsert(rows, { onConflict: "company_cnpj,process,external_item_id" });
  if (error) throw new Error("Itens mantidos neste dispositivo; falha ao salvar na nuvem.");
}

function parseNfe(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("O arquivo não parece ser um XML válido de NF-e.");

  const infNFe = xml.getElementsByTagName("infNFe")[0];
  const prot = xml.getElementsByTagName("infProt")[0];
  const ide = xml.getElementsByTagName("ide")[0];
  const emit = xml.getElementsByTagName("emit")[0];
  const dest = xml.getElementsByTagName("dest")[0];
  const totalNode = xml.getElementsByTagName("total")[0];
  const total = xml.getElementsByTagName("ICMSTot")[0];
  if (!infNFe || !ide || !emit || !dest) throw new Error("Não encontrei a estrutura principal da NF-e.");

  const emitData = participantFrom(emit);
  const destData = participantFrom(dest);
  const keyFromId = infNFe.getAttribute("Id")?.replace(/^NFe/, "") || "";
  const key = text(prot, "chNFe") || keyFromId;
  const type = onlyDigits(destData.cnpj) === COMPANY.cnpj ? "entrada" : onlyDigits(emitData.cnpj) === COMPANY.cnpj ? "saida" : "terceiros";
  if (type === "terceiros") throw new Error(`Este XML não tem ${COMPANY.name} como emitente ou destinatária.`);

  const items = [...xml.getElementsByTagName("det")].map((det) => {
    const prod = det.getElementsByTagName("prod")[0];
    const imposto = det.getElementsByTagName("imposto")[0];
    const qCom = toNumber(text(prod, "qCom"));
    const qTrib = toNumber(text(prod, "qTrib")) || qCom;
    const vProd = toNumber(text(prod, "vProd"));
    const vUnTrib = toNumber(text(prod, "vUnTrib")) || (qTrib ? vProd / qTrib : 0);
    const conversion = fiscalConversion({ description: text(prod, "xProd"), uCom: text(prod, "uCom"), qCom, uTrib: text(prod, "uTrib"), qTrib, vProd, vUnTrib });
    return {
      code: text(prod, "cProd"),
      ean: text(prod, "cEAN") || "SEM GTIN",
      eanTrib: text(prod, "cEANTrib") || text(prod, "cEAN") || "SEM GTIN",
      description: text(prod, "xProd"),
      ncm: text(prod, "NCM"),
      cest: text(prod, "CEST"),
      cfop: text(prod, "CFOP"),
      uCom: text(prod, "uCom"),
      qCom,
      vUnCom: toNumber(text(prod, "vUnCom")),
      vProd,
      vDesc: toNumber(text(prod, "vDesc")),
      uTrib: text(prod, "uTrib") || text(prod, "uCom") || "UNIDADE",
      qTrib,
      vUnTrib,
      ...conversion,
      tax: imposto ? {
        vICMS: text(imposto, "vICMS"),
        vICMSST: text(imposto, "vICMSST"),
        vIPI: text(imposto, "vIPI"),
        vPIS: text(imposto, "vPIS"),
        vCOFINS: text(imposto, "vCOFINS"),
      } : {},
    };
  });

  return {
    key,
    type,
    number: text(ide, "nNF"),
    series: text(ide, "serie"),
    issuedAt: text(ide, "dhEmi"),
    operation: text(ide, "natOp") || (type === "entrada" ? "Compra de mercadoria" : "Venda de mercadoria"),
    emit: emitData,
    dest: destData,
    participant: type === "entrada" ? emitData.name : destData.name,
    participantCnpj: type === "entrada" ? emitData.cnpj : destData.cnpj,
    total: toNumber(text(total, "vNF")),
    costComposition: {
      products: toNumber(text(total, "vProd")),
      discount: toNumber(text(total, "vDesc")),
      freight: toNumber(text(total, "vFrete")),
      insurance: toNumber(text(total, "vSeg")),
      other: toNumber(text(total, "vOutro")),
      ipi: toNumber(text(total, "vIPI")),
      icms: toNumber(text(total, "vICMS")),
      icmsSt: toNumber(text(total, "vST")) || toNumber(text(total, "vICMSST")),
      fcp: toNumber(text(total, "vFCP")),
      fcpSt: toNumber(text(total, "vFCPST")),
      importTax: toNumber(text(total, "vII")),
      ibs: toNumber(text(totalNode, "vIBS")),
      cbs: toNumber(text(totalNode, "vCBS")),
    },
    items,
    xmlOriginal: xmlText,
  };
}

function importNfe(xmlText, sourceName = "arquivo XML") {
  const document = parseNfe(xmlText);
  if (state.documents.some((doc) => doc.key === document.key)) throw new Error(`NF-e duplicada. A chave ${document.key} já foi importada.`);

  const batchId = crypto.randomUUID();
  const importedAt = new Date().toISOString();
  state.documents.unshift({ ...document, batchId, sourceName, importedAt });
  state.batches.unshift({ id: batchId, sourceName, importedAt, status: "processado", items: document.items.length, key: document.key });
  rebuildFiscalLedger();

  saveState();
  render();
  renderImportResult(document);
  return document;
}

function renderAuth() {
  const locked = !state.auth.loggedIn || state.auth.mustChangePassword;
  document.body.classList.toggle("locked", locked);
  document.getElementById("auth-screen").classList.toggle("hidden", !locked);
  document.getElementById("login-form").classList.toggle("hidden", state.auth.mustChangePassword && state.auth.loggedIn);
  document.getElementById("password-form").classList.toggle("hidden", !(state.auth.mustChangePassword && state.auth.loggedIn));
  document.getElementById("session-email").textContent = state.auth.email;
}

function render() {
  renderKpis();
  renderMovements();
  renderStock();
  renderProducts();
  renderDocuments();
  renderProposal();
  renderFiemg();
  renderFinancial();
  window.renderWorkspace?.();
  enhanceResponsiveTables();
}

function renderKpis() {
  const products = Object.values(state.products);
  const documents = state.documents;
  const entries = documents.filter((doc) => doc.type === "entrada");
  const exits = documents.filter((doc) => doc.type === "saida");
  const fiemgOpen = state.fiemg.opportunities.filter((item) => item.status !== "Não participar" && item.status !== "Proposta enviada" && item.portalGroup !== "Encerrado").length;
  const stockedProducts = products.filter((product) => Number(product.stock || 0) > 0);
  const stockUnits = stockedProducts.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  const stockValue = stockedProducts.reduce((sum, product) => sum + Number(product.stock || 0) * Number(product.averageCost || product.lastPurchasePrice || 0), 0);
  const grossProfit = state.movements.filter((movement) => movement.type === "saida").reduce((sum, movement) => sum + Number(movement.grossProfit || 0), 0);
  const cards = [
    ["Itens em estoque", number.format(stockedProducts.length), `${number.format(stockUnits)} unidades disponíveis`, "boxes"],
    ["Valor em estoque", money.format(stockValue), "Pelo custo médio de compra", "wallet"],
    ["Resultado bruto", money.format(grossProfit), `${entries.length} entradas · ${exits.length} saídas`, "chart-no-axes-combined"],
    ["Oportunidades", fiemgOpen, "Em acompanhamento na FIEMG", "briefcase-business"],
  ];
  document.getElementById("kpi-grid").innerHTML = cards.map(([label, value, hint, icon]) => `
    <article class="kpi-card"><span>${label}<i data-lucide="${icon}"></i></span><strong>${value}</strong><small>${hint}</small></article>
  `).join("");
}

function renderMovements() {
  const rows = state.movements.slice(0, 12).map((movement) => `
    <tr>
      <td>${formatDate(movement.date)}</td>
      <td class="${movement.type === "entrada" ? "positive" : "negative"}">${movement.type}</td>
      <td>${escapeHtml(movement.product)}</td>
      <td>${number.format(movement.quantity)} ${escapeHtml(movement.unit)}</td>
      <td>NF-e ${escapeHtml(movement.documentNumber)}<br><small>${maskKey(movement.documentKey)}</small></td>
    </tr>
  `);
  document.getElementById("movement-rows").innerHTML = rows.join("") || emptyRow(5, "Nenhuma movimentação importada ainda.");
}

function renderStock() {
  const rows = Object.values(state.products).map((product) => `
    <tr>
      <td><strong>${escapeHtml(product.description)}</strong><br><small>${escapeHtml(product.purchaseHistory?.[0]?.supplier || "Sem compra registrada")}</small></td>
      <td>${escapeHtml(product.ean)}</td>
      <td>${escapeHtml(product.eanTrib)}</td>
      <td>${escapeHtml(product.ncm || "-")}</td>
      <td>${escapeHtml(product.cest || "-")}</td>
      <td>${number.format(product.stock || 0)} ${escapeHtml(product.uTrib || "un")}</td>
      <td><strong>${money.format(product.lastPurchasePrice || 0)}</strong><br><small>final da NF-e por ${escapeHtml(product.uTrib || "un")}</small></td>
      <td><strong>${money.format(product.salePrice || 0)}</strong><br><small>última venda</small></td>
      <td>${formatDate(product.lastPurchase)}</td>
      <td><input class="stock-input validity-input" data-product="${escapeHtml(product.key)}" type="date" value="${escapeHtml(product.validity || "")}" /></td>
    </tr>
  `);
  document.getElementById("stock-rows").innerHTML = rows.join("") || emptyRow(10, "Importe XMLs de entrada para formar o estoque fiscal.");
}

function renderProducts() {
  const cards = Object.values(state.products).map((product) => `
    <article class="product-card">
      <strong>${escapeHtml(product.description)}</strong>
      <span>${escapeHtml(product.eanTrib)}</span>
      <small>Compra ${money.format(product.lastPurchasePrice || 0)} · Venda ${money.format(product.salePrice || 0)} · Estoque ${number.format(product.stock || 0)} ${escapeHtml(product.uTrib || "un")} · Validade ${product.validity ? formatDate(product.validity) : "não informada"}</small>
      ${product.aliases?.length ? `<small class="reconciliation-note"><i data-lucide="link-2"></i> ${product.aliases.length} descrição de saída conciliada</small>` : ""}
    </article>
  `);
  document.getElementById("product-cards").innerHTML = cards.join("") || `<p class="empty-state">O cadastro mestre será criado automaticamente pelo GTIN/EAN dos XMLs.</p>`;
}

function renderDocuments() {
  const rows = state.documents.map((doc) => {
    allocateFinalInvoiceValues(doc);
    const costDetails = doc.type === "entrada" ? `
      <details class="document-cost-details">
        <summary>Conferir custo final</summary>
        <div><span>Produtos</span><strong>${money.format(doc.productsSubtotal || 0)}</strong></div>
        <div><span>Ajuste rateado</span><strong>${Number(doc.finalAdjustment || 0) >= 0 ? "+" : ""}${money.format(doc.finalAdjustment || 0)}</strong></div>
        <ul>${doc.items.map((item) => `<li><strong>${escapeHtml(item.description)}</strong><span>${money.format(item.vProd)} → ${money.format(item.finalPurchaseTotal)} · ${money.format(item.unitCost)}/${escapeHtml(item.fiscalUnit || item.uTrib || "UN")}</span></li>`).join("")}</ul>
      </details>` : "";
    return `
      <tr>
        <td class="${doc.type === "entrada" ? "positive" : "negative"}">${doc.type}</td>
        <td>${escapeHtml(doc.number)}/${escapeHtml(doc.series)}</td>
        <td>${formatDate(doc.issuedAt)}</td>
        <td>${escapeHtml(doc.participant)}</td>
        <td>${maskKey(doc.key)}</td>
        <td><strong>${money.format(doc.total)}</strong>${costDetails}</td>
      </tr>`;
  });
  document.getElementById("document-rows").innerHTML = rows.join("") || emptyRow(6, "Nenhum documento fiscal importado.");
}

function renderImportResult(doc) {
  allocateFinalInvoiceValues(doc);
  const adjustment = Number(doc.finalAdjustment || 0);
  document.getElementById("import-result").innerHTML = `
    <div class="section-heading"><span>XML processado</span><h2>NF-e ${escapeHtml(doc.number)}/${escapeHtml(doc.series)} importada como ${escapeHtml(doc.type)}</h2></div>
    <div class="result-grid">
      <div><span>Chave</span><strong>${maskKey(doc.key)}</strong></div>
      <div><span>Participante</span><strong>${escapeHtml(doc.participant)}</strong></div>
      <div><span>Data</span><strong>${formatDate(doc.issuedAt)}</strong></div>
      <div><span>Total</span><strong>${money.format(doc.total)}</strong></div>
      ${doc.type === "entrada" ? `<div><span>Produtos antes do fechamento</span><strong>${money.format(doc.productsSubtotal || 0)}</strong></div><div><span>Ajuste final rateado</span><strong class="${adjustment >= 0 ? "positive" : "negative"}">${adjustment >= 0 ? "+" : ""}${money.format(adjustment)}</strong></div>` : ""}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Produto</th><th>Valor final do item</th><th>Estoque fiscal</th><th>Custo unitário final</th><th>Conversão</th><th>Tributos</th></tr></thead>
        <tbody>${doc.items.map((item, index) => `
          <tr>
            <td><strong>${escapeHtml(item.description)}</strong><br><small>EAN ${escapeHtml(item.ean)} · NCM ${escapeHtml(item.ncm || "-")} · CFOP ${escapeHtml(item.cfop)}</small></td>
            <td><strong>${money.format(item.finalInvoiceValue ?? item.vProd)}</strong><br><small>Produto ${money.format(item.vProd)} · ajuste ${Number(item.invoiceAdjustment || 0) >= 0 ? "+" : ""}${money.format(item.invoiceAdjustment || 0)}</small></td>
            <td><strong>${number.format(doc.type === "entrada" ? (item.fiscalQuantity || item.qTrib) : item.qTrib)} ${escapeHtml(doc.type === "entrada" ? (item.fiscalUnit || item.uTrib) : item.uTrib)}</strong></td>
            <td><strong>${money.format(doc.type === "entrada" ? (item.unitCost || item.vUnTrib || item.vUnCom) : (item.unitSalePrice || item.vUnTrib))}</strong><br><small>valor final rateado ÷ quantidade fiscal</small></td>
            <td>${doc.type === "entrada" ? `<label class="conversion-field"><span>1 ${escapeHtml(item.uCom)} =</span><input class="conversion-input" data-document="${escapeHtml(doc.key)}" data-item="${index}" type="number" min="0.0001" step="0.0001" value="${item.conversion || 1}" /><span>${escapeHtml(item.fiscalUnit || item.uTrib)}</span></label><small class="conversion-origin ${item.conversionNeedsReview ? "warning-copy" : ""}">${item.conversionSource === "xml" ? "Informada no XML" : item.conversionSource === "descricao" ? "Detectada na descrição; confira" : isPackageUnit(item.uCom) ? "Embalagem sem quantidade; informe" : "Sem conversão"}</small>` : `${number.format(item.conversion || 1)} ${escapeHtml(item.uTrib)}/${escapeHtml(item.uCom)}`}</td>
            <td>ICMS ${item.tax.vICMS || "-"} · ST ${item.tax.vICMSST || "-"} · PIS ${item.tax.vPIS || "-"} · COFINS ${item.tax.vCOFINS || "-"}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  enhanceResponsiveTables(document.getElementById("import-result"));
}

function renderProposal() {
  const rows = state.currentProposal.items.map((item, index) => `
    <tr>
      <td>${escapeHtml(item.code || "-")}</td>
      <td>${escapeHtml(item.description)}</td>
      <td>${number.format(item.quantity)}</td>
      <td>${money.format(item.unitPrice)}</td>
      <td>${money.format(item.quantity * item.unitPrice)}</td>
      <td><button class="icon-button remove-proposal-item" data-index="${index}" type="button" title="Remover item" aria-label="Remover item"><i data-lucide="trash-2"></i></button></td>
    </tr>
  `);
  const total = state.currentProposal.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  document.getElementById("proposal-rows").innerHTML = rows.join("") || emptyRow(6, "Adicione itens pelo EAN/GTIN ou manualmente.");
  document.getElementById("proposal-total").textContent = money.format(total);
  document.getElementById("saved-proposal-rows").innerHTML = state.proposals.map((proposal) => `
    <tr><td>${escapeHtml(proposal.number)}</td><td>${escapeHtml(proposal.customer)}</td><td>${formatDate(proposal.createdAt)}</td><td>${formatDate(proposal.validity)}</td><td>${money.format(proposal.total)}</td></tr>
  `).join("") || emptyRow(5, "Nenhuma proposta salva.");
  window.renderWorkspace?.();
}

function renderFinancial() {
  const container = document.getElementById("finance-kpis");
  if (!container) return;
  const purchases = state.documents.filter((document) => document.type === "entrada").reduce((sum, document) => sum + Number(document.total || 0), 0);
  const sales = state.documents.filter((document) => document.type === "saida").reduce((sum, document) => sum + Number(document.total || 0), 0);
  const costOfSales = state.movements.filter((movement) => movement.type === "saida").reduce((sum, movement) => sum + Number(movement.costTotal || 0), 0);
  const grossProfit = sales - costOfSales;
  const margin = sales > 0 ? grossProfit / sales * 100 : 0;
  const cards = [
    ["Entradas por vendas", money.format(sales), "Receita das NF-e de saída", "arrow-down-left"],
    ["Saídas por compras", money.format(purchases), "Valor das NF-e de entrada", "arrow-up-right"],
    ["Custo das vendas", money.format(costOfSales), "Custo médio dos produtos vendidos", "package-check"],
    ["Lucro bruto", money.format(grossProfit), `${number.format(margin)}% de margem bruta`, "chart-no-axes-combined"],
  ];
  container.innerHTML = cards.map(([label, value, hint, icon]) => `<article class="kpi-card"><span>${label}<i data-lucide="${icon}"></i></span><strong>${value}</strong><small>${hint}</small></article>`).join("");
  const rows = [...state.documents].sort((a, b) => String(b.issuedAt || "").localeCompare(String(a.issuedAt || ""))).map((document) => {
    const documentMovements = state.movements.filter((movement) => movement.documentKey === document.key);
    const revenue = document.type === "saida" ? Number(document.total || 0) : 0;
    const outflow = document.type === "entrada" ? Number(document.total || 0) : 0;
    const cost = documentMovements.reduce((sum, movement) => sum + Number(movement.costTotal || 0), 0);
    const profit = document.type === "saida" ? revenue - cost : 0;
    return `<tr><td>${formatDate(document.issuedAt)}</td><td><strong>NF-e ${escapeHtml(document.number)}/${escapeHtml(document.series)}</strong><br><small>${escapeHtml(document.participant || "-")}</small></td><td class="${document.type === "saida" ? "positive" : "negative"}">${document.type === "saida" ? "Venda" : "Compra"}</td><td>${money.format(revenue)}</td><td>${money.format(outflow)}</td><td><strong>${document.type === "saida" ? money.format(cost) : "-"}</strong></td><td class="${profit >= 0 ? "positive" : "negative"}">${document.type === "saida" ? money.format(profit) : "-"}</td></tr>`;
  });
  document.getElementById("finance-rows").innerHTML = rows.join("") || emptyRow(7, "Importe XMLs de entrada e saída para formar o financeiro fiscal.");
}

function enhanceResponsiveTables(root = document) {
  root.querySelectorAll(".table-wrap table").forEach((table) => {
    table.closest(".table-wrap")?.classList.add("responsive-table");
    const labels = [...table.querySelectorAll("thead th")].map((header) => header.textContent.trim());
    table.querySelectorAll("tbody tr").forEach((row) => [...row.children].forEach((cell, index) => {
      if (!cell.classList.contains("empty-state")) cell.dataset.label = labels[index] || "Detalhe";
    }));
  });
}
window.enhanceResponsiveTables = enhanceResponsiveTables;

function updateFiscalConversion(documentKey, itemIndex, factor) {
  const doc = state.documents.find((entry) => entry.key === documentKey);
  if (!doc || doc.type !== "entrada") return showToast("Não encontrei a nota de entrada para ajustar.");
  const item = doc.items[itemIndex];
  if (!item || !Number.isFinite(factor) || factor <= 0) return showToast("Informe um fator de conversão válido.");
  const newQuantity = item.qCom * factor;
  if (newQuantity <= 0) return showToast("A quantidade fiscal precisa ser maior que zero.");
  item.conversion = factor;
  item.fiscalQuantity = newQuantity;
  item.fiscalUnit = factor > 1 ? "UN" : item.uTrib || item.uCom;
  item.unitCost = Number(item.finalPurchaseTotal ?? item.vProd ?? 0) / newQuantity;
  item.conversionSource = "manual";
  item.conversionNeedsReview = false;
  rebuildFiscalLedger();
  saveState();
  render();
  renderImportResult(doc);
  showToast(`Conversão atualizada: ${number.format(newQuantity)} ${item.fiscalUnit} a ${money.format(item.unitCost)} por unidade.`);
}

function renderFiemg() {
  const opportunities = state.fiemg.opportunities || [];
  const rows = opportunities.map((item) => `
    <tr>
      <td><a class="process-link" href="/fiemg-detail.html?process=${encodeURIComponent(item.process)}" target="_blank" rel="noreferrer"><strong>${escapeHtml(item.process)}</strong><i data-lucide="external-link"></i></a><br><small>${item.regionalMatch ? "Até 50 km · " : ""}${formatDate(item.createdAt)}</small></td>
      <td>${escapeHtml(item.object)}${state.fiemg.items?.[item.process]?.length ? `<details class="fiemg-items"><summary>Consultar itens</summary><ul>${state.fiemg.items[item.process].map((part) => `<li>${escapeHtml(part.description)}<br><small>${number.format(part.quantity)} ${escapeHtml(part.unit)} · ${money.format(part.referenceUnitPrice)} por unidade</small></li>`).join("")}</ul></details>` : ""}</td>
      <td>${escapeHtml(item.entity || "-")}</td>
      <td>${formatDate(item.deadline)}</td>
      <td>${money.format(item.estimatedValue || 0)}</td>
      <td>${item.itemCount || state.fiemg.items?.[item.process]?.length || 0}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.nextStep || "-")}</td>
    </tr>
  `);
  document.getElementById("fiemg-total").textContent = opportunities.length;
  document.getElementById("fiemg-sync-status").textContent = state.fiemg.lastSyncMessage || "Pronta para sincronizar o portal.";
  document.getElementById("fiemg-rows").innerHTML = rows.join("") || emptyRow(8, "Nenhuma oportunidade FIEMG registrada ainda.");
  window.renderWorkspace?.();
}

function emptyRow(cols, message) {
  return `<tr><td colspan="${cols}" class="empty-state">${message}</td></tr>`;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3600);
}

function upsertFiemgProcess(process) {
  const processCode = process.processNumber || `FIEMG-${process.externalProcessId || Date.now()}`;
  const opportunity = {
    id: crypto.randomUUID(),
    process: processCode,
    processNumber: process.processNumber || processCode,
    externalProcessId: process.externalProcessId || null,
    object: process.object || "Processo FIEMG sem objeto informado",
    entity: process.entity || "SISTEMA FIEMG",
    modality: process.modality || "",
    deadline: process.deadline ? isoDate(process.deadline) : "",
    estimatedValue: Number(process.estimatedValue || 0),
    status: process.portalStatus || "Importado",
    portalStatus: process.portalStatus || "",
    portalGroup: process.portalGroup || "",
    itemCount: Number(process.itemCount || process.items?.length || 0),
    homologatedAt: process.homologatedAt || null,
    regionalMatch: Boolean(process.regionalMatch),
    locations: process.locations || [],
    retentionReason: process.retentionReason || "",
    portalModule: process.portalModule || null,
    nextStep: "Conferir itens importados, cruzar com estoque e precificar proposta.",
    source: "Compras FIEMG",
    sourceUrl: process.sourceUrl || "https://compras.fiemg.com.br/",
    attachmentUrl: process.attachmentUrl || "",
    createdAt: new Date().toISOString(),
    importedAt: process.importedAt || new Date().toISOString(),
  };
  const index = state.fiemg.opportunities.findIndex((item) =>
    item.process === opportunity.process || (item.externalProcessId && item.externalProcessId === opportunity.externalProcessId)
  );
  if (index >= 0) {
    opportunity.status = state.fiemg.opportunities[index].status;
    opportunity.nextStep = state.fiemg.opportunities[index].nextStep;
    opportunity.id = state.fiemg.opportunities[index].id;
    opportunity.createdAt = state.fiemg.opportunities[index].createdAt;
    state.fiemg.opportunities[index] = { ...state.fiemg.opportunities[index], ...opportunity };
  } else {
    state.fiemg.opportunities.unshift(opportunity);
  }
  if (process.items?.length) state.fiemg.items[opportunity.process] = process.items;
  return opportunity;
}

async function importFiemgProcesses(mode, code = "") {
  if (fiemgImportBusy) throw new Error("Uma sincronização já está em andamento.");
  fiemgImportBusy = true;
  document.getElementById("fiemg-sync-button").disabled = true;
  document.getElementById("fiemg-import-button").disabled = true;
  const syncStatus = document.getElementById("fiemg-sync-status");
  try {
  syncStatus.textContent = mode === "sync" ? "Sincronizando mural público..." : "Importando processo FIEMG...";
  const response = await fetch("/api/fiemg-import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, code, limit: 12, includeItems: true }),
    signal: AbortSignal.timeout(90000),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error || "Falha na importação FIEMG.");
  const saved = [];
  for (const process of payload.processes || []) {
    const opportunity = upsertFiemgProcess(process);
    saved.push(opportunity);
    localStorage.setItem("nathaliaFiscalState", JSON.stringify(state));
    await saveFiemgOpportunityRemote(opportunity);
    await saveFiemgItemsRemote(opportunity, process.items || []);
  }
  state.fiemg.lastSyncAt = new Date().toISOString();
  state.fiemg.lastSyncMessage = `${saved.length} processo(s) importado(s) da FIEMG.`;
  saveState();
  renderFiemg();
  renderKpis();
  window.renderWorkspace?.();
  return saved.length;
  } catch (error) {
    renderFiemg();
    renderKpis();
    window.renderWorkspace?.();
    syncStatus.textContent = error.message || "Não foi possível sincronizar.";
    throw error;
  } finally {
    fiemgImportBusy = false;
    document.getElementById("fiemg-sync-button").disabled = false;
    document.getElementById("fiemg-import-button").disabled = false;
  }
}

function switchView(viewId) {
  const button = document.querySelector(`.nav-item[data-view="${viewId}"]`);
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  if (button) button.classList.add("active");
  document.getElementById(viewId).classList.add("active");
  document.getElementById("view-title").textContent = button?.textContent || "Sistema";
  document.querySelectorAll(".nav-item").forEach((item) => item.setAttribute("aria-current", item === button ? "page" : "false"));
  if (viewId === "integracoes") window.maybeSyncFiemg?.();
  window.renderWorkspace?.();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportWorkbook(filename, sheets) {
  if (!window.XLSX) return showToast("Biblioteca de Excel ainda não carregou. Tente novamente.");
  const workbook = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name));
  XLSX.writeFile(workbook, filename);
}

function exportProductsForSebrae() {
  const rows = [
    SEBRAE_PRODUCT_HEADERS,
    ...Object.values(state.products).map((product) => [
      product.eanTrib || product.ean || product.internalCode || "", "PRODUTO", product.description || "",
      Number(product.lastPurchasePrice || 0), Number(product.salePrice || product.lastPurchasePrice || 0),
      "", "", product.uTrib || "UNIDADE", "SIM", product.category || "Mercadorias", "", "SIM", 0,
      Number(product.stock || 0), product.brand || "", "", "", product.internalCode || "", "NFe;Estoque Fiscal",
      "MERCADORIA PARA REVENDA", product.ncm || "", product.cfop || "", product.origin || "NACIONAL", product.cest || "",
    ]),
  ];
  exportWorkbook("produtos_sebrae_nathalia.xlsx", [{ name: "Produtos", rows }]);
}

function exportParticipants(type) {
  const source = type === "fornecedores" ? state.suppliers : state.customers;
  const rows = [
    ["CNPJ/CPF", "NOME/RAZAO SOCIAL", "NOME FANTASIA", "INSCRICAO ESTADUAL", "TELEFONE", "CEP", "UF", "MUNICIPIO", "BAIRRO", "LOGRADOURO", "NUMERO", "ULTIMA NF-E", "ULTIMA DATA"],
    ...Object.values(source).map((item) => [
      item.cnpj || "", item.name || "", item.fantasyName || "", item.ie || "", item.phone || "", item.cep || "",
      item.uf || "", item.city || "", item.district || "", item.street || "", item.number || "", item.lastDocument || "", isoDate(item.lastDate),
    ]),
  ];
  exportWorkbook(`${type}_nathalia.xlsx`, [{ name: type, rows }]);
}

function downloadProposal() {
  const total = state.currentProposal.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const lines = [
    "PROPOSTA COMERCIAL", COMPANY.name, `CNPJ: ${COMPANY.cnpjMasked}`, "",
    `Cliente: ${state.currentProposal.customer || document.getElementById("proposal-customer").value || "-"}`,
    `Validade: ${state.currentProposal.validity || document.getElementById("proposal-validity").value || "-"}`, "",
    "Codigo;Descricao;Quantidade;Valor unitario;Total",
    ...state.currentProposal.items.map((item) => `${item.code || ""};${item.description};${item.quantity};${item.unitPrice};${item.quantity * item.unitPrice}`),
    "", `Total;;;;${total}`,
  ];
  downloadBlob(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), "proposta_comercial.csv");
}

document.querySelectorAll(".nav-item, .nav-shortcut").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));

document.addEventListener("change", (event) => {
  if (event.target.classList.contains("validity-input")) {
    const product = state.products[event.target.dataset.product];
    if (product) {
      product.validity = event.target.value;
      saveState();
      renderProducts();
      showToast("Validade atualizada.");
    }
  }
  if (event.target.classList.contains("conversion-input")) {
    updateFiscalConversion(event.target.dataset.document, Number(event.target.dataset.item), Number(event.target.value));
  }
});

document.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".remove-proposal-item");
  if (removeButton) {
    state.currentProposal.items.splice(Number(removeButton.dataset.index), 1);
    saveState();
    renderProposal();
  }
});

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;
  if (supabaseReady && supabaseClient) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return showToast("E-mail ou senha inválidos.");
    state.auth.email = data.user.email || email;
    state.auth.loggedIn = true;
    state.auth.mustChangePassword = Boolean(data.user.user_metadata?.must_change_password) || password === "456070";
    await loadRemoteState();
    state.auth.loggedIn = true;
    state.auth.mustChangePassword = state.auth.mustChangePassword || password === "456070";
    saveState();
    renderAuth();
    render();
    if (state.auth.mustChangePassword) {
      showToast("Crie uma nova senha para concluir o primeiro acesso.");
      document.getElementById("new-password").focus();
      return;
    }
    showToast(`Sessão iniciada para ${state.auth.email}.`);
    return;
  }
  const passwordHash = await hashPassword(password);
  if (email !== state.auth.email || passwordHash !== state.auth.passwordHash) return showToast("E-mail ou senha inválidos.");
  state.auth.loggedIn = true;
  saveState();
  renderAuth();
  if (state.auth.mustChangePassword) {
    showToast("Crie uma nova senha para concluir o primeiro acesso.");
    document.getElementById("new-password").focus();
    return;
  }
  showToast(`Sessão iniciada para ${state.auth.email}.`);
});

document.getElementById("password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const newPassword = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;
  if (newPassword.length < 6) return showToast("Use uma senha com pelo menos 6 caracteres.");
  if (newPassword !== confirmPassword) return showToast("As senhas não conferem.");
  if (supabaseReady && supabaseClient) {
    const { error } = await supabaseClient.auth.updateUser({ password: newPassword, data: { must_change_password: false } });
    if (error) return showToast("Não consegui salvar a nova senha no servidor.");
  }
  state.auth.passwordHash = await hashPassword(newPassword);
  state.auth.mustChangePassword = false;
  state.auth.loggedIn = true;
  saveState();
  renderAuth();
  showToast("Senha alterada. A plataforma está liberada.");
});

document.getElementById("logout-button").addEventListener("click", () => {
  if (supabaseReady && supabaseClient) supabaseClient.auth.signOut();
  state.auth.loggedIn = false;
  saveState();
  renderAuth();
  showToast("Sessão encerrada.");
});

document.getElementById("choose-file").addEventListener("click", () => document.getElementById("xml-input").click());
document.getElementById("xml-input").addEventListener("change", (event) => {
  readFiles([...event.target.files]);
  event.target.value = "";
});

const dropZone = document.getElementById("drop-zone");
["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
});
["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
});
dropZone.addEventListener("drop", (event) => readFiles([...event.dataTransfer.files]));

function readFiles(files) {
  const xmlFiles = files.filter((file) => file.name.toLowerCase().endsWith(".xml") || file.type.includes("xml"));
  if (!xmlFiles.length) return showToast("Selecione arquivos XML de NF-e.");
  let processed = 0;
  let failed = 0;
  xmlFiles.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importNfe(String(reader.result), file.name);
        processed += 1;
      } catch (error) {
        failed += 1;
        showToast(`${file.name}: ${error.message}`);
      } finally {
        if (processed + failed === xmlFiles.length) showToast(`${processed} XML(s) importado(s). ${failed} com erro.`);
      }
    };
    reader.readAsText(file);
  });
}

document.getElementById("proposal-code").addEventListener("blur", (event) => {
  const value = event.target.value.trim();
  if (!value) return;
  const product = Object.values(state.products).find((item) => [item.ean, item.eanTrib, item.internalCode, item.key].includes(value));
  if (!product) return;
  document.getElementById("proposal-desc").value = product.description || "";
  document.getElementById("proposal-price").value = Number(product.salePrice || product.lastPurchasePrice || 0).toFixed(2);
});

document.getElementById("proposal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.currentProposal.customer = document.getElementById("proposal-customer").value.trim();
  state.currentProposal.validity = document.getElementById("proposal-validity").value;
  state.currentProposal.items.push({
    id: crypto.randomUUID(),
    code: document.getElementById("proposal-code").value.trim(),
    description: document.getElementById("proposal-desc").value.trim(),
    quantity: toNumber(document.getElementById("proposal-qty").value),
    unitPrice: toNumber(document.getElementById("proposal-price").value),
  });
  document.getElementById("proposal-code").value = "";
  document.getElementById("proposal-desc").value = "";
  document.getElementById("proposal-qty").value = "1";
  document.getElementById("proposal-price").value = "0";
  saveState();
  renderProposal();
});

document.getElementById("save-proposal").addEventListener("click", () => {
  const customer = document.getElementById("proposal-customer").value.trim() || state.currentProposal.customer;
  if (!customer || !state.currentProposal.items.length) return showToast("Informe cliente e pelo menos um item.");
  const total = state.currentProposal.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  state.proposals.unshift({
    id: crypto.randomUUID(),
    number: `PROP-${String(state.proposals.length + 1).padStart(4, "0")}`,
    customer,
    validity: document.getElementById("proposal-validity").value || state.currentProposal.validity,
    items: structuredClone(state.currentProposal.items),
    total,
    createdAt: new Date().toISOString(),
  });
  state.currentProposal = structuredClone(initialState.currentProposal);
  document.getElementById("proposal-customer").value = "";
  document.getElementById("proposal-validity").value = "";
  saveState();
  renderProposal();
  showToast("Proposta salva sem movimentar estoque.");
});

document.getElementById("fiemg-import-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = document.getElementById("fiemg-import-code").value.trim();
  if (!code) return showToast("Informe o número SDE/CDE para importar.");
  document.getElementById("fiemg-import-button").disabled = true;
  try {
    const count = await importFiemgProcesses("single", code);
    document.getElementById("fiemg-import-code").value = "";
    showToast(`${count} processo FIEMG importado automaticamente.`);
  } catch (error) {
    showToast(error.message || "Não consegui importar o processo FIEMG.");
  } finally {
    document.getElementById("fiemg-import-button").disabled = false;
  }
});

document.getElementById("fiemg-sync-button").addEventListener("click", async () => {
  document.getElementById("fiemg-sync-button").disabled = true;
  try {
    const count = await importFiemgProcesses("sync");
    showToast(`${count} processo(s) sincronizado(s) do mural FIEMG.`);
  } catch (error) {
    showToast(error.message || "Não consegui sincronizar o mural FIEMG.");
  } finally {
    document.getElementById("fiemg-sync-button").disabled = false;
  }
});

document.getElementById("fiemg-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const opportunity = {
    id: crypto.randomUUID(),
    process: document.getElementById("fiemg-process").value.trim(),
    object: document.getElementById("fiemg-object").value.trim(),
    entity: document.getElementById("fiemg-entity").value.trim(),
    deadline: document.getElementById("fiemg-deadline").value,
    estimatedValue: toNumber(document.getElementById("fiemg-value").value),
    status: document.getElementById("fiemg-status").value,
    nextStep: document.getElementById("fiemg-next").value.trim(),
    source: "Compras FIEMG",
    sourceUrl: "https://compras.fiemg.com.br/",
    createdAt: new Date().toISOString(),
  };
  if (!opportunity.process || !opportunity.object) return showToast("Informe processo e objeto da oportunidade.");
  const existing = state.fiemg.opportunities.findIndex((item) => item.process === opportunity.process);
  if (existing >= 0) {
    state.fiemg.opportunities[existing] = { ...state.fiemg.opportunities[existing], ...opportunity, id: state.fiemg.opportunities[existing].id };
  } else {
    state.fiemg.opportunities.unshift(opportunity);
  }
  document.getElementById("fiemg-form").reset();
  document.getElementById("fiemg-value").value = "0";
  saveState();
  renderFiemg();
  renderKpis();
  window.renderWorkspace?.();
  try { await saveFiemgOpportunityRemote(opportunity); }
  catch (error) { showToast(error.message); return; }
  showToast("Oportunidade FIEMG salva no pipeline.");
});

document.getElementById("download-proposal").addEventListener("click", downloadProposal);
document.getElementById("export-products").addEventListener("click", exportProductsForSebrae);
document.getElementById("export-suppliers").addEventListener("click", () => exportParticipants("fornecedores"));
document.getElementById("export-customers").addEventListener("click", () => exportParticipants("clientes"));

const installButton = document.getElementById("install-button");
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return showToast("No iPhone, use Compartilhar e depois Adicionar à Tela de Início.");
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

rebuildFiscalLedger();
localStorage.setItem("nathaliaFiscalState", JSON.stringify(state));
renderAuth();
render();
initSupabase();
